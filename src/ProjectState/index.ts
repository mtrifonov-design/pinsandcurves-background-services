import { PinsAndCurvesProjectController } from "@mtrifonov-design/pinsandcurves-external";
import getController from "./GetController";

type ProjectNodeEventDispatcher = PinsAndCurvesProjectController.ProjectNodeEventDispatcher;

class State {
    controller: PinsAndCurvesProjectController.PinsAndCurvesProjectController;
    constructor() {
        const dispatch = (e: any) => this.emit(e);
        this.controller = getController(dispatch);
    }
    channel : string = "ProjectState";
    subscribers : { [instance_id: string]: any } = {};
    subscribe(receiver : { instance_id: string, modality: string, resource_id: string }) {
        // if (!this.subscribers.includes(address)) {
        //     this.subscribers.push(address)
        // }
        this.subscribers[receiver.instance_id] = receiver;


        // send current state to address
        this.addToWorkload(receiver, "subscribeConfirmation", true);
    }
    workload : { [thread: string]: any[]} = {};
    addToWorkload(receiver : {
        instance_id: string,
        modality: string,
        resource_id: string
    }, request: string, messagePayload: any) {
        if (!this.workload["default"]) {
            this.workload["default"] = [];
        }
        this.workload["default"].push(
            {
                type: "worker",
                receiver,
                payload: {
                    channel: "ProjectState",
                    request: "projectNodeEvent",
                    payload: messagePayload,
                }
            }
        )
    }
    emit(payload: any) {
        Object.values(this.subscribers).forEach(receiver => {
            this.addToWorkload(receiver, "projectNodeEvent", payload);
        })
    }
    distribute(source: string, request: string, payload: any) {
        // const otherSubscribers = this.subscribers.filter(subscriber => subscriber !== source);
        // otherSubscribers.forEach(address => {
        //     this.sendTo(address, request, payload);
        // })
        this.emit(payload);
        this.controller.receive(payload);
    }

}

const state = new State()

function onCompute(string: string) {
    string = decodeURI(string);
    const unit = JSON.parse(string);
    log(unit)
    const { channel, request, payload } = unit.payload;

    // sendMessage("CORE::CORE::CORE", controller);

    if (channel === "ProjectState") {
        if (request === "subscribe") {
            state.subscribe(unit.sender);
            // @ts-ignore
            return {};

        } 
        if (request === "projectNodeEvent") {
            state.distribute(unit.sender, "projectNodeEvent", payload);
        }

        // @ts-ignore
        // sendMessage(source, {
        //     channel: "responseProject",
        //     request,
        //     payload: controller.getProject(),
        // })
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


