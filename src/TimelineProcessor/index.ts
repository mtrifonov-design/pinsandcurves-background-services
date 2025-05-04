import { PinsAndCurvesProjectController, TimelineController } from "@mtrifonov-design/pinsandcurves-external";
import getController from "./GetController";


type ProjectNodeEventDispatcher = PinsAndCurvesProjectController.ProjectNodeEventDispatcher;

function createUnit(receiver: any, payload: any) {
    return {
        type: "worker",
        receiver,
        payload
    };
}

class State {
    controller: TimelineController.TimelineController;
    addToWorkload: (unit:any) => void;
    constructor(asset: any, addToWorkload: (unit:any) => void) {
        this.addToWorkload = addToWorkload;
        this.controller = TimelineController.TimelineController.fromSerializedWorm(asset);
    }

    sendMessage(receiver: any, payload: any) {
        const unit = createUnit(receiver, payload);
        this.addToWorkload(unit);
    }

    receiveUpdates(sender:any, updates: any, request_id: string, asset_id: string) {
        updates.forEach((update: any) => {
            this.controller.receiveIncomingEvent(update);
        });
        const asset = this.controller.serialize();
        this.sendMessage(sender, {
            maintainerUpdateResponse: {
                asset_data: asset,
                request_id,
                asset_id,
            }
        })
    }


}

let workload : any = {};
function addToWorkload(unit: any) {
    const existingUnits = workload.assetServer || [];
    workload = {
        assetServer: [...existingUnits, unit]
    };
}
function clearWorkload() {
    workload = {
    };
}

let state;

function onCompute(string: string) {
    string = decodeURI(string);
    const unit = JSON.parse(string);
    const { payload, sender } = unit;

    const { init, processUpdates } = payload;

    if (init) {
        state = new State(init, addToWorkload);
        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }

    if (processUpdates) {

        const { updates, request_id, asset_id } = processUpdates;
        state.receiveUpdates(sender, updates,request_id, asset_id);

        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
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


