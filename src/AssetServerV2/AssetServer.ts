import { Asset, SerialisedAsset } from "./Asset";

class IndexAsset extends Asset {
    constructor(addToWorkload: (unit:any) => void) {
        super({
            id: "index",
            data: {},
            metadata: {},
            on_update: {
                type: "simple",
            }
        }, addToWorkload);
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

    createAsset(instance: any, asset: SerialisedAsset, subscription_name: string) {
        const newAsset = new Asset(asset, this.addToWorkload.bind(this));
        this.assets.push(newAsset);
        newAsset.subscribe(instance,{
            receive_initial_state: false,
            subscription_name,
        })
        this.updateIndexAsset();
    }
    subscribeToExistingAsset(instance: any, assetId: string, subscription_name: string) {
        const asset = this.assets.find(asset => asset.id === assetId);
        if (asset) {
            asset.subscribe(instance, {
                receive_initial_state: true,
                subscription_name: subscription_name,
            });
        }
    }
    updateAsset(assetId: string, update: any, subscription_id: string) {
        const asset = this.assets.find(asset => asset.id === assetId);
        if (asset) {
            asset.receiveUpdate(update, subscription_id);
        }
    }
    deleteAsset(assetId: string, subscription_id: string) {
        const asset = this.assets.find(asset => asset.id === assetId);
        if (asset) {
            asset.receiveDelete(subscription_id);
            this.assets = this.assets.filter(a => a.id !== assetId);
        }
    }
    
}

export default AssetServer;