
type Asset = {
    asset_id: string;
    asset_name: string;
    asset_type: string;
    data: any;
    width?: number;
    height?: number;
}

class State {

    assetDB: Asset[] = [];

    constructor() {
    }

    receiveAssets(sender_id: any,payload: Asset[]) {
        this.assetDB.push(...payload);
        const preview = this.assetDB.map(asset => {
            return {
                asset_id: asset.asset_id,
                asset_name: asset.asset_name,
                asset_type: asset.asset_type,
                width: asset.width,
                height: asset.height
            }
        });
        console.log("Assets: ", preview);
        this.emit(sender_id,payload)

    }



    sendAssets(assetIdList: string[], receiver: any) {
        const assets = this.assetDB.filter(asset => assetIdList.includes(asset.asset_id));
        if (assets.length === 0) return;
        this.addToWorkload(receiver, "assetResponse", assets);
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
                    request: request,
                    payload: messagePayload,
                }
            }
        )
    }

    clearWorkload() {
        this.workload = {};
    }

    subscribers : { [instance_id: string]: any } = {};
    subscribe(receiver : { instance_id: string, modality: string, resource_id: string }) {
        this.subscribers[receiver.instance_id] = receiver;
        this.addToWorkload(receiver, "subscribeConfirmation", this.assetDB);
    }

    emit(sender_id: string,payload: any) {
        Object.keys(this.subscribers).forEach(subscriber_id => {
            if (subscriber_id === sender_id) return;
            this.addToWorkload(this.subscribers[subscriber_id], "assetEvent", payload);
        })
    }
}

const state = new State()

function onCompute(string: string) {
    string = decodeURI(string);
    const unit = JSON.parse(string);
    const { request, payload, SAVE_SESSION, LOAD_SESSION, SUBSCRIBE, key, state:s  } = unit.payload;
    console.log(unit);

    if (SAVE_SESSION) {
        return {
            persistence: [{
                type: "worker",
                receiver: unit.sender,
                payload: {
                    key,
                    SAVE_SESSION,
                    state: state.assetDB,
                }
            }]
        };
    }

    if (LOAD_SESSION) {
        const assetDB = s;
        //state.subscribers = subscribers;
        state.assetDB = assetDB;
        return {};
    }

    if (request === "subscribe") {
        state.subscribe(unit.sender);
        const workload = state.workload;
        state.clearWorkload();
        return workload;
    }

    if (request === "pushAssets") {
        state.receiveAssets(unit.sender.instance_id,payload);
        const workload = state.workload;
        state.clearWorkload();
        return workload;
    } 

    if (request === "requestAssets") {
        state.sendAssets(payload, unit.sender);
        const workload = state.workload;
        state.clearWorkload();
        return workload;
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


