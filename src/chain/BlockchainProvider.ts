/**
 * Generic, chain-independent abstraction of some things.
 */
import { logDebug } from '@/Messages';
import { ref, watchEffect } from 'vue';

import { Provider, RpcProvider } from 'starknet';
import { getBaseUrl } from '@/url';

import { CHAIN_NETWORKS, getCurrentNetwork } from './Network';

class BlockchainProvider {
    provider: RpcProvider | undefined;

    alive = true;

    constructor(p: any) {
        this.provider = p;
    }

    isAlive() {
        return this.alive;
    }

    async getTransactionStatus(tx_hash: string): Promise<'NOT_RECEIVED' | 'RECEIVED' | 'PENDING' | 'ACCEPTED_ON_L2' | 'ACCEPTED_ON_L1' | 'REJECTED'> {
        try {
            return (await this.provider!.getTransactionReceipt(tx_hash)).status!;
        } catch(_) {
            return 'NOT_RECEIVED';
        }
    }

    async getTransactionBlock(tx_hash: string) {
        try {
            const data = await this.provider?.getTransactionReceipt(tx_hash);
            return {
                block_number: data!.block_number as number,
                status: (data!.execution_status || 'NOT_RECEIVED') as 'SUCCEEDED' | 'REVERTED' | 'NOT_RECEIVED',
            }
        } catch (_) {
            // Fail in a safe-way for calling code.
            return {
                block_number: undefined,
                status: 'NOT_RECEIVED' as const,
            };
        }
    }

    getTransaction(tx_hash: string) {
        return this.provider?.getTransaction(tx_hash);
    }
}

export function getProviderForNetwork(network: CHAIN_NETWORKS): RpcProvider {
    return {
        'localhost': new Provider({ sequencer: { baseUrl: 'http://localhost:5050/' } }),
        'starknet-testnet': new Provider({ rpc: { nodeUrl: `${getBaseUrl()}/v1/node/starknet-testnet/rpc`, retries: 2 } }),
        'starknet-testnet-dojo': new Provider({ rpc: { nodeUrl: `${getBaseUrl()}/v1/node/starknet-testnet-dojo/rpc`, retries: 2 } }),
        'starknet-mainnet': new Provider({ rpc: { nodeUrl: `${getBaseUrl()}/v1/node/starknet-mainnet/rpc`, retries: 3 } }),
        'starknet-mainnet-dojo': new Provider({ rpc: { nodeUrl: `${getBaseUrl()}/v1/node/starknet-mainnet-dojo/rpc`, retries: 3 } }),
    }[network];
}

export const blockchainProvider = ref(new BlockchainProvider(undefined));

export function getProvider() {
    return blockchainProvider;
}

watchEffect(() => {
    blockchainProvider.value.provider = getProviderForNetwork(getCurrentNetwork());
    logDebug('SWITCHING BLOCKCHAIN PROVIDER TO ', getCurrentNetwork());
});
