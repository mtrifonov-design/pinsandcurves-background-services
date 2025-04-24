'use strict';

var persistentData = {
    messages: [],
};
var subscribers = [];
function onCompute(string) {
    string = decodeURI(string);
    var unit = JSON.parse(string);
    var _a = unit.payload, channel = _a.channel, request = _a.request, payload = _a.payload; _a.subscriber_id; var SAVE_SESSION = _a.SAVE_SESSION, LOAD_SESSION = _a.LOAD_SESSION, key = _a.key, state = _a.state;
    if (SAVE_SESSION) {
        return {
            persistence: [{
                    type: "worker",
                    receiver: unit.sender,
                    payload: {
                        key: key,
                        SAVE_SESSION: SAVE_SESSION,
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
            default: subscribers.map(function (subscriber) { return ({
                type: "worker",
                receiver: subscriber,
                payload: {
                    channel: "PERSISTENT_DATA",
                    request: "responseData",
                    payload: persistentData,
                }
            }); })
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
            };
        }
        if (request === "sendData") {
            console.log("Received data: ", payload);
            persistentData = payload;
            return {};
        }
    }
}
onCompute(decodeURI(JSON.stringify({
    payload: {
        channel: "SELF",
        request: "getProject",
        payload: {}
    }
})));
//# sourceMappingURL=index.js.map
