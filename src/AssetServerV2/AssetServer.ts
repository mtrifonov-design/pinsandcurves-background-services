import { Asset, SerialisedAsset } from "./Asset";

class IndexAsset extends Asset {
    constructor(addToWorkload: (unit:any) => void) {
        super({
            data: {},
            metadata: {},
            on_update: {
                type: "simple",
            }
        }, addToWorkload);
        this.id = "index";
    }
}

class AssetServer {
    assets: Asset[] = [];
    addToWorkload: (unit:any) => void;
    constructor(addToWorkload: (unit:any) => void) {
        this.addToWorkload = addToWorkload;
        // Initialize the asset server
        this.assets.push(new IndexAsset(this.addToWorkload.bind(this)));
    }

    loadAssets(assets: SerialisedAsset[]) {
        this.assets.push(...assets.map(asset => new Asset(asset, this.addToWorkload.bind(this))));
        this.updateIndexAsset();
    }

    saveAssets() {
        const dirtyAssetExists = this.assets.some(asset => asset.dirty);
        if (dirtyAssetExists) {
            this.assets.forEach(asset => {
                if (asset.dirty) asset.sync();
            });
            return;
        }
        const assets = this.assets.filter(asset => asset.id !== "index").map(asset => asset.serialize());
        return assets;
    }

    updateIndexAsset() {
        const indexAsset = this.assets.find(asset => asset.id === "index");
        if (indexAsset) {
            const newIndexData : { [key: string] : any } = {};
            this.assets.filter(asset => asset.id !== "index").forEach(asset => {
                newIndexData[asset.id] = asset.metadata;
            });
            indexAsset.receiveUpdate(newIndexData);
        }
    }

    createAsset(instance: any, asset: SerialisedAsset, subscription_name?: string) {
        const newAsset = new Asset(asset, this.addToWorkload.bind(this),
        subscription_name ? instance : undefined, subscription_name);
        this.assets.push(newAsset);
        // newAsset.subscribe(instance,{
        //     receive_initial_state: false,
        //     subscription_name,
        // })
        this.updateIndexAsset();
    }
    subscribeToExistingAsset(instance: any, assetId: string, subscription_name: string) {
        const asset = this.assets.find(asset => asset.id === assetId);
        if (asset) {
            asset.subscribe(instance, {
                receive_initial_state: true,
                subscription_name: subscription_name,
            });
            return;
        }
        throw new Error(`Asset with id ${assetId} not found`);
    }
    unsubscribeFromAsset(assetId: string, subscription_id: string) {
        const asset = this.assets.find(asset => asset.id === assetId);
        if (asset) {
            asset.unsubscribe(subscription_id);
        }
    }

    updateAsset(assetId: string, update: any, subscription_id: string) {
        const asset = this.assets.find(asset => asset.id === assetId);
        //console.log("updateAsset", assetId, update, subscription_id);
        if (asset) {
            asset.receiveUpdate(update, subscription_id);
        }
    }

    updateAssetMetadata(assetId: string, metadata: any, subscription_id: string) {
        const asset = this.assets.find(asset => asset.id === assetId);
        if (asset) {
            asset.receiveUpdateMetadata(metadata, subscription_id);
            this.updateIndexAsset();
        }
    }

    maintainerUpdateResponse(assetId: string, update: any) {
        const asset = this.assets.find(asset => asset.id === assetId);
        if (asset) {
            asset.receiveUpdateFromMaintainer(update);
        }
    }

    deleteAsset(assetId: string, subscription_id: string) {
        const asset = this.assets.find(asset => asset.id === assetId);
        if (asset) {
            asset.receiveDelete(subscription_id);
            this.assets = this.assets.filter(a => a.id !== assetId);
            this.updateIndexAsset();
        }
    }
    
}

export default AssetServer;