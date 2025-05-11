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
let savedKey;
let awaitingSave = false;
function onCompute(string: string) {
    string = decodeURI(string);
    const unit = JSON.parse(string);
    const { SAVE_SESSION, LOAD_SESSION, key, state,
        createAsset,
        subscribeToExistingAsset,
        unsubscribeFromAsset,
        updateAsset,
        deleteAsset,
        updateAssetMetadata,
        maintainerUpdateResponse,

    } = unit.payload;

    if (SAVE_SESSION) {
        const savedAssets = assetServer.saveAssets();
        if (savedAssets === undefined) {
            savedKey = key;
            awaitingSave = true;
            const currentWorkload = workload;
            clearWorkload();
            return currentWorkload;
        }
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
        const { asset_id, subscription_name } = subscribeToExistingAsset;
        //console.log("Received subscribeToExistingAsset", asset_id, subscription_name, assetServer.assets);
        assetServer.subscribeToExistingAsset(unit.sender, asset_id, subscription_name);
        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }

    if (unsubscribeFromAsset) {
        const { asset_id, subscription_id } = unsubscribeFromAsset;
        assetServer.unsubscribeFromAsset(asset_id, subscription_id);
        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }

    if (updateAsset) {
        const { asset_id, update, subscription_id } = updateAsset;
        assetServer.updateAsset(asset_id, update, subscription_id);
        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }

    if (updateAssetMetadata) {
        const { asset_id, metadata, subscription_id } = updateAssetMetadata;
        //console.log("updateAssetMetadata", asset_id, metadata, subscription_id);
        assetServer.updateAssetMetadata(asset_id, metadata, subscription_id);
        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }

    if (deleteAsset) {
        const { asset_id, subscription_id } = deleteAsset;
        assetServer.deleteAsset(asset_id, subscription_id);
        const currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }

    if (maintainerUpdateResponse) {
        const { asset_id  } = maintainerUpdateResponse;
        assetServer.maintainerUpdateResponse(asset_id, maintainerUpdateResponse);
        //console.log("maintainerUpdateResponse", asset_id, maintainerUpdateResponse, awaitingSave);
        if (awaitingSave) {
            const savedAssets = assetServer.saveAssets();
            if (savedAssets !== undefined) {
                addToWorkload({
                    type: "worker",
                    receiver: {
                        instance_id: "persistence",
                        resource_id: "persistence",
                        modality: "persistence"
                    },
                    payload: {
                        key: savedKey as string,
                        SAVE_SESSION: true,
                        state: assetServer.saveAssets(),
                    }
                });
                awaitingSave = false;
                savedKey = undefined;
                // return {
                //     persistence: [{
                //         type: "worker",
                //         receiver: unit.sender,
                //         payload: {
                //             key: savedKey as string,
                //             SAVE_SESSION: true,
                //             state: assetServer.saveAssets(),
                //         }
                //     }]
                // };
            }
        }
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


