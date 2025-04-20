import { PinsAndCurvesProjectController } from "@mtrifonov-design/pinsandcurves-external";

type ProjectNodeEventDispatcher = PinsAndCurvesProjectController.ProjectNodeEventDispatcher;

let persistentData = {
    messages: [],
};
let subscribers = [];
function onCompute(string: string) {
    string = decodeURI(string);
    const unit = JSON.parse(string);
    const { channel, request, payload, subscriber_id, SAVE_SESSION, LOAD_SESSION, key, state  } = unit.payload;


    if (SAVE_SESSION) {
        return {
            persistence: [{
                type: "worker",
                receiver: unit.sender,
                payload: {
                    key,
                    SAVE_SESSION,
                    state: persistentData,
                }
            }]
        };
    }

    if (LOAD_SESSION) {
        if (state) {
            persistentData = state;
        }
        return {
            default: subscribers.map((subscriber) => ({
                type: "worker",
                receiver: subscriber,
                payload: {
                    channel: "PERSISTENT_DATA",
                    request: "responseData",
                    payload: persistentData,
                }
            }))
        };
    }

    if (channel === "PERSISTENT_DATA") {
        if (request === "requestData") {
            subscribers.push(unit.sender);
                return {
                    default: [{
                        type: "worker",
                        receiver: unit.sender,
                        payload: {
                            channel: "PERSISTENT_DATA",
                            request: "responseData",
                            payload: persistentData,
                        }
                    }]
                }


        } 
        if (request === "sendData") {
            console.log("Received data: ", payload);
            persistentData = payload;
            return {};
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


