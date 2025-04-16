import { PinsAndCurvesProjectController } from "@mtrifonov-design/pinsandcurves-external";

type ProjectNodeEventDispatcher = PinsAndCurvesProjectController.ProjectNodeEventDispatcher;

// class State {
//     controller: PinsAndCurvesProjectController.PinsAndCurvesProjectController;
//     constructor() {
//         const dispatch = (e: any) => this.send(e);
//         this.controller = getController(dispatch);
//     }

//     changeController(worm: any) {
//         const dispatch = (e: any) => this.send(e);
//         this.controller = getController(dispatch, worm);
//     }

//     send(payload: any) {
//         if (this.receiver_id === "") return;
//         if (payload.type === "hostIsConnected") return;
//         this.addToWorkload(this.subscribers[this.receiver_id], "projectNodeEvent", payload, this.receiver_id);
//     }

//     receiver_id: string = "";
//     channel : string = "ProjectState";
//     subscribers : { [instance_id: string]: any } = {};
//     subscribe(receiver : { instance_id: string, modality: string, resource_id: string }, subscriber_id: string) {
//         this.subscribers[subscriber_id] = receiver;
//         this.addToWorkload(receiver, "subscribeConfirmation", true, subscriber_id);
//     }
//     workload : { [thread: string]: any[]} = {};
//     addToWorkload(receiver : {
//         instance_id: string,
//         modality: string,
//         resource_id: string
//     }, request: string, messagePayload: any, subscriber_id: string) {
//         if (!this.workload["default"]) {
//             this.workload["default"] = [];
//         }
//         this.workload["default"].push(
//             {
//                 type: "worker",
//                 receiver,
//                 payload: {
//                     channel: "ProjectState",
//                     request: request,
//                     payload: messagePayload,
//                     subscriber_id,
//                 }
//             }
//         )
//     }
//     emit(payload: any) {
//         Object.keys(this.subscribers).forEach(subscriber_id => {
//             this.addToWorkload(this.subscribers[subscriber_id], "projectNodeEvent", payload, subscriber_id);
//         })
//     }
//     distribute(payload: any) {
//         this.emit(payload);
//         this.controller.receive(payload);
//     }

//     clearWorkload() {
//         this.workload = {};
//     }

// }

// const state = new State()

let client : PinsAndCurvesProjectController.PinsAndCurvesProjectController;

let pendingWorkload = {};
function addToWorkload(payload: any) {
    if (pendingWorkload.default === undefined) {
        pendingWorkload.default = [];
    }
    pendingWorkload.default.push({
        type: "worker",
        receiver: {
            instance_id: "BACKGROUND",
            modality: "wasmjs",
            resource_id: "http://localhost:8000/ProjectState"
        },
        payload: {
            ...payload,
            subscriber_id: "CopilotEval",
        },
    });
}

function onCompute(string: string) {
    string = decodeURI(string);
    const unit = JSON.parse(string);
    const { INIT, EVAL, timelineOperations, channel, request, payload  } = unit.payload;

    if (channel === "ProjectState" && request === "projectNodeEvent") {
        client.receive(payload);
        return {};
    }

    if (EVAL) {
        if (client === undefined) {
            return false;
        }
        const projectTools = client.projectTools;
        if (projectTools === undefined) {
            return false;
        }
        let currentOperation = "";
        try {
            for (const i in timelineOperations) {
                const operation = timelineOperations[i];
                currentOperation = operation;
                eval(operation)
            }
        } catch (e) {
            log(`Last operation: ${currentOperation}. Error in eval: ${e}`);
        } 
        const workload = pendingWorkload;
        pendingWorkload = {};
        return workload;
    }

    if (INIT) {
        const dispatch = (e: any) => addToWorkload({channel: "ProjectState", request: "projectNodeEvent", payload: e});
        addToWorkload({channel: "ProjectState", request: "subscribe", subscriber_id: "CopilotEval"})
        client = PinsAndCurvesProjectController.PinsAndCurvesProjectController.Client(dispatch);
        client.connectToHost();
        const workload = pendingWorkload;
        pendingWorkload = {};
        return workload;
    }

    return {}

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


