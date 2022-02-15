import { MouseInputState } from './BuilderInputState';
import { store } from '../../store/Store'
import type { SetData } from '../SetData'
import type { Briq } from '../Briq.js';
import { selectionRender } from './Selection';
import getPreviewCube from '../graphics/PreviewCube'
import { THREE } from '../../three';

export class InspectInput extends MouseInputState
{
    gui!: { briq: Briq | undefined, curX: number, curY: number };

    lastClickPos: [number, number, number] | undefined;

    override onEnter()
    {
        this.setGuiData({
            briq: undefined,
            curX: 0,
            curY: 0,
        });
        selectionRender.show();
    }

    override onExit() {
        this.gui.briq = undefined;
        selectionRender.hide();
    }

    async onPointerMove(event: PointerEvent)
    {
        this.gui.curX = this.curX;
        this.gui.curY = this.curY;

        const pos = this.getIntersectionPos(this.curX, this.curY, true);
        // If the position is on the ground then there's no cube, and vice-versa.
        if (!pos || pos[1] < 0)
            this.gui.briq = undefined;
        else
            this.gui.briq = (store.state.builderData.currentSet as SetData).getAt(...pos);
    }

    async onPointerDown(event: PointerEvent)
    {
        if (event.shiftKey)
            this.fsm.switchTo("inspect_multi", { x: event.clientX, y: event.clientY });
    }

    async onPointerUp(event: PointerEvent)
    {
        let mov = Math.abs(event.clientX - this.lastClickX) + Math.abs(event.clientY - this.lastClickY);
        if (mov > 10)
            return;

        const pos = this.getIntersectionPos(this.curX, this.curY, true);
        if (event.button === 2)
        {
            if (!pos || pos[1] < 0)
                this.fsm.store.selectionMgr.clear();
            else
                this.fsm.store.selectionMgr.remove(...pos);
        }
        else if (true)
        {
            if (!pos || pos[1] < 0)
                this.fsm.store.selectionMgr.clear();
            else
                this.fsm.store.selectionMgr.add(...pos);
        }
        else
        {
            if (!pos || pos[1] < 0)
                this.fsm.store.selectionMgr.clear();
            else
                this.fsm.store.selectionMgr.selectAt(...pos);
        }
    }
}

export class InspectMultiInput extends MouseInputState
{
    lastClickPos!: [number, number, number];

    onEnter(data: any) {
        this.curX = data.x;
        this.curY = data.y;

        this.lastClickPos = this.getIntersectionPos(this.curX, this.curY, true)!;
        if (!this.lastClickPos)
            throw new Error("Error: InspectMultiInput must have a well defined event position on entry");

        this.fsm.orbitControls.enabled = false;

        selectionRender.show();
        getPreviewCube().visible = true;
        (getPreviewCube().material as THREE.MeshPhongMaterial).color = new THREE.Color(0x002496);
    }

    onExit() {
        getPreviewCube().visible = false;
        this.fsm.orbitControls.enabled = true;
        selectionRender.hide();
    }

    async onPointerMove(event: PointerEvent)
    {
        let pos = this.getIntersectionPos(this.curX, this.curY, true);
        if (!pos)
            return;

        if (this.lastClickPos[1] === -1 && pos[1] === -1)
            pos[1] = 0;

        getPreviewCube().scale.set(Math.abs(this.lastClickPos[0] - pos[0]) + 1.1, Math.abs(this.lastClickPos[1] - pos[1]) + 1.1, Math.abs(this.lastClickPos[2] - pos[2]) + 1.1);
        getPreviewCube().position.set(
            ((this.lastClickPos[0] + pos[0]) / 2) + 0.5,
            ((this.lastClickPos[1] + pos[1]) / 2) + 0.5,
            ((this.lastClickPos[2] + pos[2]) / 2) + 0.5,
        );
    }

    async onPointerUp(event: PointerEvent)
    {
        try
        {
            let pos = this.getIntersectionPos(this.curX, this.curY, true);
            if (!pos)
                return;

            // Make it so that floor-squares have at least one-cell of erasing.
            if (this.lastClickPos[1] === -1 && pos[1] === -1)
                pos[1] = 0;

            let briqs = [];
            for (let x = Math.min(this.lastClickPos[0], pos[0]); x <= Math.max(this.lastClickPos[0], pos[0]); ++x)
                for (let y = Math.min(this.lastClickPos[1], pos[1]); y <= Math.max(this.lastClickPos[1], pos[1]); ++y)
                    for (let z = Math.min(this.lastClickPos[2], pos[2]); z <= Math.max(this.lastClickPos[2], pos[2]); ++z)
                    {
                        let briq = store.state.builderData.currentSet.getAt(x, y, z);
                        if (briq)
                            briqs.push(briq);
                    }
            this.fsm.store.selectionMgr.select(briqs, true);
        } finally {
            this.fsm.switchTo("inspect");
        }
    }
}
