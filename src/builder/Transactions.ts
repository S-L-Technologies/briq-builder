import { reactive, watch, watchEffect, toRef } from 'vue';
import { walletStore2 } from '@/chain/Wallet';
import { blockchainProvider } from '@/chain/BlockchainProvider';

const CURR_VERSION = 3;

const address = toRef(walletStore2, 'userWalletAddress');

function getUserAddress(): string {
    return address.value;
}

class TransactionsManager {
    transactions: Array<Transaction>;
    transactionsByKW: { [key: string]: Array<Transaction> };
    constructor() {
        this.transactions = [];
        this.transactionsByKW = {};
    }

    loadFromStorage() {
        this.transactions = [];
        this.transactionsByKW = {};

        if (!address.value)
            return;
        try {
            const storedTxs = window.localStorage.getItem('transactions_' + getUserAddress());
            if (!storedTxs)
                return;
            const txs = JSON.parse(storedTxs);
            if (txs.version !== CURR_VERSION)
                throw new Error('bad version');
            for (const txdata of txs.txs) {
                // TX is too old, skip
                if (Date.now() - txdata?.[3]?.timestamp > 1000 * 3600 * 24)
                    continue;
                new Transaction(...txdata);
            }
            this.transactions.forEach((x) => x.poll());
        } catch (err) {
            console.warn('Failed to load transactions:', err);
            window.localStorage.removeItem('transactions_' + getUserAddress());
        }
    }

    add(tx: Transaction, keyword: string) {
        this.transactions.push(tx);
        if (!this.transactionsByKW[keyword])
            this.transactionsByKW[keyword] = [];
        this.transactionsByKW[keyword].push(tx);
        this.transactions.forEach((x) => x.poll());
        this.serialize();
    }

    delete(tx: Transaction) {
        this.transactions.splice(
            this.transactions.findIndex((x) => x.hash === tx.hash),
            1,
        );
        this.transactionsByKW[tx.keyword].splice(
            this.transactionsByKW[tx.keyword].findIndex((x) => x.hash === tx.hash),
            1,
        );

        this.serialize();
    }

    serialize() {
        // Shouldn't really happen, and won't matter.
        if (!getUserAddress())
            return;
        window.localStorage.setItem(
            'transactions_' + getUserAddress(),
            JSON.stringify({
                version: CURR_VERSION,
                txs: this.transactions.map((x) => [x.hash, x.keyword, x.metadata, x.status]),
            }),
        );
    }

    getTx(hash: string): Transaction | undefined {
        return this.transactions.find((x) => x.hash === hash);
    }

    get(keyword: string): Array<Transaction> {
        return this.transactionsByKW?.[keyword] ?? [];
    }

    anyPending(): boolean {
        return this.transactions.some((x) => x.isPending());
    }
}

type TxStatus = 'UNKNOWN' | 'PENDING' | 'ERROR' | 'ACCEPTED';

export class Transaction {
    status: TxStatus;
    hash: string;
    keyword: string;
    mgr: TransactionsManager;
    metadata: any;

    refreshing = false;

    constructor(hash: string, keyword: string, metadata?: any, status?: TxStatus) {
        this.hash = hash;
        this.keyword = keyword;

        this.metadata = metadata || {};
        if (!this.metadata.timestamp)
            this.metadata.timestamp = Date.now();
        this.status = status || 'UNKNOWN';

        // Keep these last as they trigger the serialization.
        this.mgr = transactionsManager;
        this.mgr.add(this, keyword);
    }

    delete() {
        this.mgr.delete(this);
    }

    async poll() {
        if (!blockchainProvider.value)
            return;

        if (this.refreshing)
            return;
        this.refreshing = true;
        try {
            const status = (await blockchainProvider.value.getTransactionStatus(this.hash)).tx_status;
            // Treat 'not received' as pending, as the TX shouldn't stay in that state for long.
            if (status === 'PENDING' || status === 'RECEIVED' || status === 'NOT_RECEIVED')
                this.status = 'PENDING';
            else if (status === 'REJECTED')
                this.status = 'ERROR';
            else if (status === 'ACCEPTED_ON_L2' || status === 'ACCEPTED_ON_L1' || status === 'ACCEPTED_ONCHAIN')
                // Last one ought be temporary
                this.status = 'ACCEPTED';
            else
                this.status = 'ERROR';
            this.mgr.serialize();
        } catch (err) {
            /*ignore*/
        }
        this.refreshing = false;
    }

    isOk() {
        return this.status !== 'ERROR';
    }

    async getMetadata() {
        if (!blockchainProvider.value)
            return undefined;
        return await blockchainProvider.value.getTransaction(this.hash);
    }

    isOnChain() {
        return this.status === 'ACCEPTED';
    }

    isPending() {
        return this.status === 'PENDING' || this.status === 'UNKNOWN';
    }
}

export const transactionsManager = reactive(new TransactionsManager());
watch(blockchainProvider, () => transactionsManager.loadFromStorage());
watch(address, () => transactionsManager.loadFromStorage());
transactionsManager.loadFromStorage();
