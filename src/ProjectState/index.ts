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
    subscribers : string[] = []
    subscribe(address : string) {
        if (!this.subscribers.includes(address)) {
            this.subscribers.push(address)
        }
        // send current state to address
        this.sendTo(address, "subscribeConfirmation", true);
    }
    unsubscribe(address : string) {
        this.subscribers = this.subscribers.filter(subscriber => subscriber !== address)
    }
    sendTo(address : string, request: string, payload: any) {
        sendMessage(address, {
            channel: this.channel,
            request: request,
            payload,
        })
    }
    emit(payload: any) {
        this.subscribers.forEach(address => {
            this.sendTo(address, "projectNodeEvent", payload);
        })
    }
    distribute(source: string, request: string, payload: any) {
        const otherSubscribers = this.subscribers.filter(subscriber => subscriber !== source);
        otherSubscribers.forEach(address => {
            this.sendTo(address, request, payload);
        })
        this.controller.receive(payload);
    }

}

const state = new State()

function onMessage(string: string) {
    string = decodeURI(string);
    const { source, content } = JSON.parse(string);
    const { channel, request, payload } = content;

    // sendMessage("CORE::CORE::CORE", controller);

    if (channel === "ProjectState") {

        if (request === "subscribe") {
            state.subscribe(source);
            // @ts-ignore
        } 
        if (request === "projectNodeEvent") {
            state.distribute(source, "projectNodeEvent", payload);
        }

        // @ts-ignore
        // sendMessage(source, {
        //     channel: "responseProject",
        //     request,
        //     payload: controller.getProject(),
        // })
    }


}

onMessage(
    decodeURI(
        JSON.stringify({
            source: "SELF::SELF::SELF",
            content: {
                channel: "SELF",
                request: "getProject",
                payload: {}
            }
        })
    )
)


