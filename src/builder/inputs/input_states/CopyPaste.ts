import { MouseInputState } from './BuilderInputState';
import { store } from '@/store/Store';

import type { HotkeyHandle } from '@/Hotkeys';

import { SelectionManager, selectionRender } from '../Selection';
import { THREE } from '@/three';
import { pushMessage } from '@/Messages';

export class CopyPasteInput extends MouseInputState {
    lastClickPos: [number, number, number] | undefined;

    selectionCenter!: THREE.Vector3;
    min!: [number, number, number];
    max!: [number, number, number];
    boundingBoxCenter!: [number, number, number];

    ColorOK = new THREE.Color(0x002496);
    ColorOverlay = new THREE.Color(0xffaa000);

    cancelHotkey!: HotkeyHandle;
    pasteHotkey!: HotkeyHandle;

    override onEnter() {
        selectionRender.show();
        this.selectionCenter = this.fsm.store.selectionMgr.getCenterPos();
        if (!this.selectionCenter)
            throw new Error('Entered copy paste with no selection');

        const briqs = this.fsm.store.selectionMgr.selectedBriqs;
        this.min = briqs[0].position!.slice();
        this.max = briqs[0].position!.slice();
        for (let i = 1; i < briqs.length; ++i) {
            if (briqs[i].position![0] > this.max[0])
                this.max[0] = briqs[i].position![0];
            if (briqs[i].position![0] < this.min[0])
                this.min[0] = briqs[i].position![0];
            if (briqs[i].position![1] > this.max[1])
                this.max[1] = briqs[i].position![1];
            if (briqs[i].position![1] < this.min[1])
                this.min[1] = briqs[i].position![1];
            if (briqs[i].position![2] > this.max[2])
                this.max[2] = briqs[i].position![2];
            if (briqs[i].position![2] < this.min[2])
                this.min[2] = briqs[i].position![2];
        }
        this.boundingBoxCenter = [
            (this.max[0] + this.min[0]) / 2 + 0.5,
            (this.max[1] + this.min[1]) / 2 + 0.5,
            (this.max[2] + this.min[2]) / 2 + 0.5,
        ];
        this.cancelHotkey = this.fsm.hotkeyMgr.subscribe('escape', () => {
            this.fsm.switchTo('inspect');
        });
        this.fsm.hotkeyMgr.register('paste', { code: 'KeyV', ctrl: true });
        this.pasteHotkey = this.fsm.hotkeyMgr.subscribe('paste', () => {
            this.doPaste();
        });

        this.onPointerMove();
    }

    override onExit() {
        selectionRender.hide();
        selectionRender.parent.position.set(0, 0, 0);
        selectionRender.parent.children[0].material.color = this.ColorOK;
        this.fsm.hotkeyMgr.unsubscribe(this.pasteHotkey);
        this.fsm.hotkeyMgr.unsubscribe(this.cancelHotkey);
    }

    _specialClamp(res: [number, number, number]) {
        const x0 = this.boundingBoxCenter[0] - this.min[0];
        const y0 = this.boundingBoxCenter[1] - this.min[1];
        const z0 = this.boundingBoxCenter[2] - this.min[2];
        const x1 = this.max[0] - this.boundingBoxCenter[0] + 1;
        const z1 = this.max[2] - this.boundingBoxCenter[2] + 1;
        const canvasSize = this.canvasSize();
        res[0] = res[0] < -canvasSize + x0 ? -canvasSize + x0 : res[0] >= canvasSize - x1 ? +canvasSize - x1 : res[0];
        res[2] = res[2] < -canvasSize + z0 ? -canvasSize + z0 : res[2] >= canvasSize - z1 ? +canvasSize - z1 : res[2];
        res[1] = res[1] < y0 ? y0 : res[1];
        return res;
    }

    async onPointerMove() {
        const intersection = this._getIntersectionPos(this.curX, this.curY);
        if (!intersection)
            return;
        let pos = intersection.position.map((v, ndx) => {
            return v + (intersection.normal[ndx] * (this.max[ndx] - this.min[ndx] + 1)) / 2;
        });
        const corr = [
            this.selectionCenter.x - this.boundingBoxCenter[0],
            this.selectionCenter.y - this.boundingBoxCenter[1],
            this.selectionCenter.z - this.boundingBoxCenter[2],
        ];
        /*
        console.log("Intersection pos", intersection.position);
        console.log("Correction: ", corr)
        console.log("Initial pos", pos);
        console.log("Corrected", [pos[0] + corr[0] - this.selectionCenter.x,
            pos[1] + corr[1] - this.selectionCenter.y,
            pos[2] + corr[2] - this.selectionCenter.z]);
        console.log(this.min, this.max, this.selectionCenter)
        */

        pos = this._specialClamp(pos);
        selectionRender.parent.position.set(
            Math.round(pos[0] + corr[0] - this.selectionCenter.x),
            Math.round(pos[1] + corr[1] - this.selectionCenter.y),
            Math.round(pos[2] + corr[2] - this.selectionCenter.z),
        );
        // Color the mesh if there is an overlay.
        let overlay = true;
        for (const briq of this.fsm.store.selectionMgr.selectedBriqs) {
            const bp = [
                Math.round(pos[0] + briq.position![0] + corr[0] - this.selectionCenter.x),
                Math.round(pos[1] + briq.position![1] + corr[1] - this.selectionCenter.y),
                Math.round(pos[2] + briq.position![2] + corr[2] - this.selectionCenter.z),
            ];
            if (store.state.builderData.currentSet.getAt(...bp)) {
                overlay = false;
                break;
            }
        }
        selectionRender.parent.children[0].material.color = overlay ? this.ColorOK : this.ColorOverlay;
    }

    async onPointerDown(event: PointerEvent) {}

    async onPointerUp(event: PointerEvent) {
        const mov = Math.abs(event.clientX - this.lastClickX) + Math.abs(event.clientY - this.lastClickY);
        if (mov > 10)
            return;

        if (event.button === 2) {
            this.fsm.switchTo('inspect');
            return;
        }

        await this.doPaste();
    }

    async doPaste() {
        const intersection = this._getIntersectionPos(this.curX, this.curY);
        if (!intersection) {
            this.fsm.switchTo('inspect');
            return;
        }
        let pos = intersection.position.map((v, ndx) => {
            return v + (intersection.normal[ndx] * (this.max[ndx] - this.min[ndx] + 1)) / 2;
        });
        const corr = [
            this.selectionCenter.x - this.boundingBoxCenter[0],
            this.selectionCenter.y - this.boundingBoxCenter[1],
            this.selectionCenter.z - this.boundingBoxCenter[2],
        ];
        pos = this._specialClamp(pos);
        let didOverlay = false;
        const data = [];
        const positions = [];
        for (const briq of this.fsm.store.selectionMgr.selectedBriqs) {
            const bp = [
                Math.round(pos[0] + briq.position![0] + corr[0] - this.selectionCenter.x),
                Math.round(pos[1] + briq.position![1] + corr[1] - this.selectionCenter.y),
                Math.round(pos[2] + briq.position![2] + corr[2] - this.selectionCenter.z),
            ];
            if (store.state.builderData.currentSet.getAt(...bp) && this.fsm.store.briqOverlayMode === 'KEEP') {
                didOverlay = true;
                continue;
            }
            positions.push(bp);
            // Explicitly do not copy NFT ids, for those cannot be duplicated.
            data.push({ pos: bp, color: briq.color, material: briq.material });
        }
        await store.dispatch('builderData/place_briqs', data);

        if (didOverlay && this.fsm.store.briqOverlayMode === 'KEEP')
            pushMessage('Some briqs were not placed because they overlayed existing briqs');

        this.fsm.store.selectionMgr.clear();
        for (const p of positions)
            this.fsm.store.selectionMgr.add(...p);

        this.fsm.switchTo('inspect');
    }
}
