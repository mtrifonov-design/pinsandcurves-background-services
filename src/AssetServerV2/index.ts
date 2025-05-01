import AssetServer from "./AssetServer";

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

const assetServer = new AssetServer(addToWorkload)

function onCompute(string: string) {
    string = decodeURI(string);
    const unit = JSON.parse(string);
    const { SAVE_SESSION, LOAD_SESSION, key, state,
        createAsset,
        subscribeToExistingAsset,
        updateAsset,
        deleteAsset,

    } = unit.payload;

    if (SAVE_SESSION) {
        return {
            persistence: [{
                type: "worker",
                receiver: unit.sender,
                payload: {
                    key,
                    SAVE_SESSION,
                    state: assetServer.saveAssets(),
                }
            }]
        };
    }

    if (LOAD_SESSION) {
        if (state) {
            assetServer.loadAssets(state);
        }
        return {};
    }


    if (createAsset) {
        const { asset, subscription_name } = createAsset;
        assetServer.createAsset(unit.sender, asset, subscription_name);
        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }

    if (subscribeToExistingAsset) {
        const { assetId, subscription_name } = subscribeToExistingAsset;
        assetServer.subscribeToExistingAsset(unit.sender, assetId, subscription_name);
        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }

    if (updateAsset) {
        const { assetId, update, subscription_id } = updateAsset;
        assetServer.updateAsset(assetId, update, subscription_id);
        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }

    if (deleteAsset) {
        const { assetId, subscription_id } = deleteAsset;
        assetServer.deleteAsset(assetId, subscription_id);
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


