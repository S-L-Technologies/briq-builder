import type * as THREETYPES from 'three';
import type three_wrapper from './three_wrapper';

import { logDebug } from './Messages';

// This is a lie.
export var THREE: typeof THREETYPES;

export var OrbitControls: three_wrapper.OrbitControls;
export var SelectionBox: three_wrapper.SelectionBox;
export var BufferGeometryUtils: three_wrapper.BufferGeometryUtils;

export var EffectComposer: three_wrapper.EffectComposer;
export var RenderPass: three_wrapper.RenderPass;
export var SAOPass: three_wrapper.SAOPass;
export var ShaderPass: three_wrapper.ShaderPass;
export var SSAARenderPass: three_wrapper.SSAARenderPass;
export var CopyShader: three_wrapper.CopyShader;

async function setup() {
    let wrapper = await import ('./three_wrapper');
    THREE = wrapper.THREE;
    OrbitControls = wrapper.OrbitControls;
    SelectionBox = wrapper.SelectionBox;
    BufferGeometryUtils = wrapper.BufferGeometryUtils;

    EffectComposer = wrapper.EffectComposer;
    RenderPass = wrapper.RenderPass;
    SAOPass = wrapper.SAOPass;
    ShaderPass = wrapper.ShaderPass;
    SSAARenderPass = wrapper.SSAARenderPass;
    CopyShader = wrapper.CopyShader;

    logDebug("Successfully dynamically loaded three.js");
}
export  var THREE_SETUP = setup();