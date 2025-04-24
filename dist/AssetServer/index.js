'use strict';

var State = /** @class */ (function () {
    function State() {
        this.assetDB = [];
        this.workload = {};
        this.subscribers = {};
    }
    State.prototype.receiveAssets = function (sender_id, payload) {
        var _a;
        // delete the assets that are about to be replaced
        this.assetDB = this.assetDB.filter(function (asset) { return !payload.map(function (p) { return p.asset_id; }).includes(asset.asset_id); });
        (_a = this.assetDB).push.apply(_a, payload);
        var preview = this.assetDB.map(function (asset) {
            return {
                asset_id: asset.asset_id,
                asset_name: asset.asset_name,
                asset_type: asset.asset_type,
                width: asset.width,
                height: asset.height
            };
        });
        console.log("Assets: ", preview);
        this.emit(sender_id, payload);
    };
    State.prototype.sendAssets = function (assetIdList, receiver) {
        var assets = this.assetDB.filter(function (asset) { return assetIdList.includes(asset.asset_id); });
        if (assets.length === 0)
            return;
        this.addToWorkload(receiver, "assetResponse", assets);
    };
    State.prototype.addToWorkload = function (receiver, request, messagePayload) {
        if (!this.workload["default"]) {
            this.workload["default"] = [];
        }
        this.workload["default"].push({
            type: "worker",
            receiver: receiver,
            payload: {
                request: request,
                payload: messagePayload,
            }
        });
    };
    State.prototype.clearWorkload = function () {
        this.workload = {};
    };
    State.prototype.subscribe = function (receiver) {
        this.subscribers[receiver.instance_id] = receiver;
        this.addToWorkload(receiver, "subscribeConfirmation", this.assetDB);
    };
    State.prototype.unsubscribe = function (receiver) {
        delete this.subscribers[receiver.instance_id];
        this.addToWorkload(receiver, "unsubscribeConfirmation", true);
    };
    State.prototype.emit = function (sender_id, payload) {
        var _this = this;
        console.log(this.subscribers);
        Object.keys(this.subscribers).forEach(function (subscriber_id) {
            if (subscriber_id === sender_id)
                return;
            _this.addToWorkload(_this.subscribers[subscriber_id], "assetEvent", payload);
        });
    };
    return State;
}());
var state = new State();
function onCompute(string) {
    string = decodeURI(string);
    var unit = JSON.parse(string);
    var _a = unit.payload, request = _a.request, payload = _a.payload, SAVE_SESSION = _a.SAVE_SESSION, LOAD_SESSION = _a.LOAD_SESSION, key = _a.key, s = _a.state;
    // console.log(unit);
    if (SAVE_SESSION) {
        return {
            persistence: [{
                    type: "worker",
                    receiver: unit.sender,
                    payload: {
                        key: key,
                        SAVE_SESSION: SAVE_SESSION,
                        state: state.assetDB,
                    }
                }]
        };
    }
    if (LOAD_SESSION) {
        if (s) {
            var assetDB = s;
            //state.subscribers = subscribers;
            state.assetDB = assetDB;
        }
        return {};
    }
    if (request === "subscribe") {
        state.subscribe(unit.sender);
        var workload = state.workload;
        state.clearWorkload();
        return workload;
    }
    if (request === "unsubscribe") {
        state.unsubscribe(unit.sender);
        var workload = state.workload;
        state.clearWorkload();
        return workload;
    }
    if (request === "pushAssets") {
        state.receiveAssets(unit.sender.instance_id, payload);
        var workload = state.workload;
        state.clearWorkload();
        return workload;
    }
    if (request === "requestAssets") {
        state.sendAssets(payload, unit.sender);
        var workload = state.workload;
        state.clearWorkload();
        return workload;
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
