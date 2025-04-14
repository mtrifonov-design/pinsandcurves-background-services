import { PinsAndCurvesProjectController } from "@mtrifonov-design/pinsandcurves-external";
import getController from "./GetController";

type ProjectNodeEventDispatcher = PinsAndCurvesProjectController.ProjectNodeEventDispatcher;

class State {
    controller: PinsAndCurvesProjectController.PinsAndCurvesProjectController;
    constructor() {
        const dispatch = (e: any) => this.send(e);
        this.controller = getController(dispatch);
    }

    changeController(worm: any) {
        const dispatch = (e: any) => this.send(e);
        this.controller = getController(dispatch, worm);
    }

    send(payload: any) {
        if (this.receiver_id === "") return;
        if (payload.type === "hostIsConnected") return;
        this.addToWorkload(this.subscribers[this.receiver_id], "projectNodeEvent", payload, this.receiver_id);
    }

    receiver_id: string = "";
    channel : string = "ProjectState";
    subscribers : { [instance_id: string]: any } = {};
    subscribe(receiver : { instance_id: string, modality: string, resource_id: string }, subscriber_id: string) {
        this.subscribers[subscriber_id] = receiver;
        this.addToWorkload(receiver, "subscribeConfirmation", true, subscriber_id);
    }
    workload : { [thread: string]: any[]} = {};
    addToWorkload(receiver : {
        instance_id: string,
        modality: string,
        resource_id: string
    }, request: string, messagePayload: any, subscriber_id: string) {
        if (!this.workload["default"]) {
            this.workload["default"] = [];
        }
        this.workload["default"].push(
            {
                type: "worker",
                receiver,
                payload: {
                    channel: "ProjectState",
                    request: request,
                    payload: messagePayload,
                    subscriber_id,
                }
            }
        )
    }
    emit(payload: any) {
        Object.keys(this.subscribers).forEach(subscriber_id => {
            this.addToWorkload(this.subscribers[subscriber_id], "projectNodeEvent", payload, subscriber_id);
        })
    }
    distribute(payload: any) {
        this.emit(payload);
        this.controller.receive(payload);
    }

    clearWorkload() {
        this.workload = {};
    }

}

const state = new State()

function onCompute(string: string) {
    string = decodeURI(string);
    const unit = JSON.parse(string);
    const { channel, request, payload, subscriber_id, SAVE_SESSION, LOAD_SESSION, key, state:s  } = unit.payload;


    if (SAVE_SESSION) {
        return {
            persistence: [{
                type: "worker",
                receiver: unit.sender,
                payload: {
                    key,
                    SAVE_SESSION,
                    state: {
                        worm:state.controller.serializeWorm(),
                        //subscribers: state.subscribers,
                    }
                }
            }]
        };
    }

    if (LOAD_SESSION) {
        const { worm, subscribers} = s;
        //state.subscribers = subscribers;
        state.changeController(worm);
        return {};
    }


    state.receiver_id = subscriber_id;
    if (channel === "ProjectState") {
        if (request === "subscribe") {
            state.subscribe(unit.sender, subscriber_id);
            const workload = state.workload;
            state.clearWorkload();
            return workload;

        } 
        if (request === "projectNodeEvent") {
            state.distribute(payload);
            const workload = state.workload;
            state.clearWorkload();
            return workload;
        }
    }
}



onCompute(
    decodeURI(
        JSON.stringify({
            payload: {
                channel: "SELF",
                request: "getProject",
                payload: {}
            }
        })
    )
)


