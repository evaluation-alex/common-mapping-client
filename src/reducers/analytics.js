import Immutable from 'immutable';
import fetch from 'isomorphic-fetch';
import * as actionTypes from '../constants/actionTypes';
import * as appConfig from '../constants/appConfig';
import { analyticsState } from './models/analytics';

//IMPORTANT: Note that with Redux, state should NEVER be changed.
//State is considered immutable. Instead,
//create a copy of the state passed and set new values on the copy.

const INCLUDED_ACTIONS = new Immutable.List([]);
const EXCLUDED_ACTIONS = new Immutable.List([
    // Map Actions
    actionTypes.SET_LAYER_OPACITY,
    actionTypes.INGEST_LAYER_CONFIG,
    actionTypes.MERGE_LAYERS,
    actionTypes.PIXEL_HOVER,
    actionTypes.INGEST_LAYER_PALETTES,

    // Async Actions
    actionTypes.LOAD_INITIAL_DATA,
    actionTypes.INITIAL_DATA_LOADED,
    actionTypes.LOAD_LAYER_PALETTES,
    actionTypes.LAYER_PALETTES_LOADED,
    actionTypes.LOAD_LAYERS,
    actionTypes.LAYERS_LOADED,

    // Date Slider Actions
    actionTypes.BEGIN_DRAGGING,
    actionTypes.END_DRAGGING,
    actionTypes.HOVER_DATE,
    actionTypes.TIMELINE_MOUSE_OUT,

    // Misc
    actionTypes.NO_ACTION
]);

const processAction = (state, action) => {
    // skip items we don't care about or if analytics is not enabled
    if (!state.get("isEnabled") ||
        (INCLUDED_ACTIONS.size > 0 && !INCLUDED_ACTIONS.contains(action.type)) ||
        (EXCLUDED_ACTIONS.size > 0 && EXCLUDED_ACTIONS.contains(action.type))) {
        return state;
    }

    // iterate over action members converting Immutable data to standard JS objects
    for (let param in action) {
        if (action.hasOwnProperty(param)) {
            let val = action[param];
            if (typeof val.toJS !== "undefined") {
                action[param] = val.toJS();
            }
        }
    }

    // create and store the analytic
    let analytic = {
        sessionId: state.get("sessionId"),
        sequenceId: state.get("currBatchNum"),
        action: action
    };
    state = state.set("currentBatch", state.get("currentBatch").push(analytic));
    console.log("Added analytic to batch.", analytic);

    // send batches every 5 seconds or whenever 10 actions are gathered
    let then = state.get("timeLastSent");
    let now = new Date();
    if (now - then >= 5000 || state.get("currentBatch").size >= 10) {
        // convert the current batch to a string
        let batch = JSON.stringify(state.get("currentBatch"));

        // post the batch
        console.log("Sending analytic batch.", batch);
        fetch(appConfig.ANALYTICS_ENDPOINT, {
            method: 'POST',
            body: batch
        }).then(function(response) {
            console.log("Stored analytic batch: SUCCESS.");
        }).catch((err) => {
            console.warn("Stored analytic batch: FAIL.", err);
        });

        // clear the current batch and update the sent time
        state = state
            .set("currentBatch", Immutable.List())
            .set("timeLastSent", new Date());
    }

    return state;
};

const setAnalyticsEnabled = (state, action) => {
    return state.set("isEnabled", action.isEnabled);
};

export default function analytics(state = analyticsState, action) {
    switch (action.type) {
        case actionTypes.SET_ANALYTICS_ENABLED:
            return setAnalyticsEnabled(state, action);
        default:
            return processAction(state, action);
    }
}
