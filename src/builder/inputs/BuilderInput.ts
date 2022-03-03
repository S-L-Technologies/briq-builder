import type { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BuilderInputState, MouseInputState } from './BuilderInputState'

import { inputMap } from '../../builder/inputs/InputMap'

import type { inputStore } from './InputStore';
import type { HotkeyManager } from '../../Hotkeys';

import { reactive } from 'vue';
export class BuilderInputFSM
{
    state!: BuilderInputState;
    canvas!: HTMLCanvasElement;
    orbitControls!: OrbitControls;
    store!: typeof inputStore;
    hotkeyMgr!: HotkeyManager;

    gui: any;

    _initialisePromise: any;

    initialize(canv: HTMLCanvasElement, oc: OrbitControls, store: typeof inputStore, hotkeyMgr: HotkeyManager)
    {
        this.canvas = canv;
        this.orbitControls = oc;
        this.store = store;
        this.hotkeyMgr = hotkeyMgr;
        this.gui = reactive({});
        this._initialisePromise();
    }

    switchTo(state: string, data?: object)
    {
        if (this.state)
            this.state._onExit();
        let oldState = this.state;
        this.state = new inputMap[state](this, this.canvas);
        if (this.state instanceof MouseInputState && oldState instanceof MouseInputState)
        {
            this.state.curX = oldState.curX;
            this.state.curY = oldState.curY;
            this.state.lastX = oldState.lastX;
            this.state.lastY = oldState.lastY;
        }
        this.state._onEnter(data);
    }

    waitForInit = (() => {
        return new Promise((resolve, reject) => {
            this._initialisePromise = resolve;
        });
    })();

    //

    async onFrame()
    {
        if (this.state)
            await this.state._onFrame();
    }

    async onPointerMove(event: PointerEvent)
    {
        await this.state._onPointerMove(event);
    }

    async onPointerDown(event: PointerEvent)
    {
        await this.state._onPointerDown(event);
    }

    async onPointerUp(event: PointerEvent)
    {
        await this.state._onPointerUp(event);
    }
}

export var builderInputFsm = new BuilderInputFSM();
