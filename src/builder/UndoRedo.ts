import { pushMessage } from '../Messages'

import { markRaw } from 'vue';

type Hook = (localData: any, payload: any, state: any) => void;

const onBefore: { [key: string]: Hook } = {};
const onAfter: { [key: string]: Hook } = {};
const humanOutputs: { [key: string]: (data: any) => string } = {};

export function registerUndoableAction(action: string, hooks: { onBefore?: Hook, onAfter?: Hook }, humanOutput?: (data: any) => string)
{
    if (hooks.onBefore)
        onBefore[action] = hooks.onBefore;
    if (hooks.onAfter)
        onAfter[action] = hooks.onAfter;
    
    if (humanOutput)
        humanOutputs[action] = humanOutput;
    else
        humanOutputs[action] = () => action;
}

export function getHumanOutput(action: string, data: any): string
{
    return humanOutputs[action](data);
}

export const UndoRedo = (store: any) => {
    let transientActionState: any = {};
    store.subscribeAction({
        before: async (action: any, state: any) => {
            if (action.type === "undo_history" || action.type === "redo_history")
                await store.dispatch("redoing", true)
            if (state.undoRedo.redoing || !(action.type in onBefore))
                return;
            transientActionState = {};
            onBefore[action.type]({ transientActionState, store }, action.payload, state);
        },
        after: async (action: any, state: any) => {
            if (action.type === "undo_history" || action.type === "redo_history")
                await store.dispatch("redoing", false);
            if (state.undoRedo.redoing || !(action.type in onAfter))
                return;
            onAfter[action.type]({ transientActionState, store }, action.payload, state);
        }
    })
}

export const undoRedoStore = {
    state: {
        command_history: [],
        command_index: -1,
        redoing: false,
    },
    actions: {
        push_command_to_history: ({ state, commit }: any, data: any) => {
            if (!state.redoing)
                commit("push_command_to_history", data);
        },
        undo_history: async ({ dispatch, commit, state }: any) => {
            if (state.command_index < 0)
                return;
            await state.command_history[state.command_index].undo();
            // Must be done before undoing or we lose the state.
            pushMessage("Undo complete - " + getHumanOutput(state.command_history[state.command_index].action, state.command_history[state.command_index]));
            commit("undo_history");
        },
        redo_history: async ({ dispatch, commit, state }: any) => {
            if (state.command_index + 1 >= state.command_history.length)
                return;
            await state.command_history[state.command_index + 1].redo();
            commit("redo_history");
            pushMessage("Redo complete - " + getHumanOutput(state.command_history[state.command_index].action, state.command_history[state.command_index]));
        },
        reset_history: ({ commit }: any) => {
            commit("reset_history");
        },
        redoing: ({ commit }: any, data: any) => {
            commit("redoing", data);
        },
    },
    mutations: {
        redoing: (state: any, data: any) => {
            state.redoing = data;
        },
        push_command_to_history: (state: any, data: any) => {
            state.command_history = state.command_history.slice(0, state.command_index + 1);
            state.command_history.push(markRaw(data));
            ++state.command_index;
        },
        undo_history: (state: any) => {
            --state.command_index;
        },
        redo_history: (state: any) => {
            ++state.command_index;
        },
        reset_history: (state: any) => {
            state.command_index = -1;
            state.command_history = [];
        }
    },
};
