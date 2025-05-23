'use strict';

/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */

var extendStatics = function(d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
    return extendStatics(d, b);
};

function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
        throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}

function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
}

typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};

function createUnit(receiver, payload) {
    return {
        type: "worker",
        receiver: receiver,
        payload: payload
    };
}
var Asset = /** @class */ (function () {
    function Asset(sa, addToWorkload, instance, subscription_name) {
        this._dirty = false;
        this.pending_requests = {};
        this.outstanding_updates = [];
        this.subscribers = {};
        this.id = sa.id;
        this.data = sa.data;
        this.metadata = sa.metadata;
        this.on_update = sa.on_update;
        this.addToWorkload = addToWorkload;
        // establish connection to the asset maintainer
        if (this.on_update.type === 'custom') {
            this.maintainer = {
                instance_id: this.on_update.processor.resource_id + "_" + this.id,
                resource_id: this.on_update.processor.resource_id,
                modality: this.on_update.processor.modality,
            };
            this.addToWorkload(createUnit(this.maintainer, {
                init: this.data,
            }));
            if (instance && subscription_name) {
                this.subscribe(instance, {
                    receive_initial_state: false,
                    subscription_name: subscription_name,
                });
            }
        }
    }
    Object.defineProperty(Asset.prototype, "dirty", {
        get: function () {
            return this._dirty;
        },
        set: function (val) {
            // only allow setting dirty to true if the asset is externally maintained
            if (val) {
                if (this.on_update.type === 'simple') {
                    return;
                }
                else {
                    this._dirty = true;
                }
            }
            else {
                if (Object.keys(this.pending_requests).length > 0)
                    return;
                this._dirty = false;
            }
        },
        enumerable: false,
        configurable: true
    });
    Asset.prototype.readAsset = function (subscription_id) {
        if (this.dirty) {
            var request_id = this.pushOutstandingUpdates();
            this.pending_requests[request_id] = {
                subscription_id: subscription_id,
                type: 'read',
            };
        }
        else {
            // answer the request
            var subscriber = this.subscribers[subscription_id];
            var getAssetResponse = {
                subscription_id: subscription_id,
                asset_id: this.id,
                asset_data: this.data,
            };
            this.addToWorkload(createUnit(subscriber.instance, {
                getAssetResponse: getAssetResponse,
            }));
        }
    };
    Asset.prototype.sync = function () {
        if (this.dirty) {
            var request_id = this.pushOutstandingUpdates();
            this.pending_requests[request_id] = {
                type: 'sync',
            };
        }
    };
    Asset.prototype.pushOutstandingUpdates = function () {
        if (this.dirty) {
            if (!this.maintainer) {
                throw new Error("Asset is dirty but has no maintainer");
            }
            // send outstanding updates to asset maintainer
            var request_id = randomUUID();
            this.addToWorkload(createUnit(this.maintainer, {
                processUpdates: {
                    updates: this.outstanding_updates,
                    asset_id: this.id,
                    request_id: request_id,
                }
            }));
            this.outstanding_updates = [];
            return request_id;
        }
        throw new Error("Asset is not dirty");
    };
    Asset.prototype.serialize = function () {
        return {
            id: this.id,
            data: this.data,
            metadata: this.metadata,
            on_update: this.on_update,
        };
    };
    Asset.prototype.receiveUpdateFromMaintainer = function (payload) {
        var request_id = payload.request_id, asset_data = payload.asset_data;
        // update the asset data
        this.data = asset_data;
        // answer the request
        var _a = this.pending_requests[request_id], subscription_id = _a.subscription_id, type = _a.type;
        if (type === "read")
            this.readAsset(subscription_id);
        delete this.pending_requests[request_id];
        this.dirty = false;
    };
    Asset.prototype.receiveUpdate = function (update, subscription_id) {
        var _this = this;
        if (this.on_update.type === 'simple') {
            this.data = update;
        }
        else {
            this.dirty = true;
            this.outstanding_updates.push(update);
        }
        // distribute the update to all subscribers except the one that sent it
        // const updateReceivers = subscription_id ?
        //     Object.keys(this.subscribers).filter(subscriber_id => subscriber_id !== subscription_id)
        //     : Object.keys(this.subscribers);
        var updateReceivers = Object.keys(this.subscribers);
        updateReceivers.forEach(function (subscriber_id) {
            var subscriber = _this.subscribers[subscriber_id];
            var receiveUpdate = {
                subscription_id: subscriber_id,
                update: update,
            };
            _this.addToWorkload(createUnit(subscriber.instance, {
                receiveUpdate: receiveUpdate,
            }));
        });
    };
    Asset.prototype.receiveUpdateMetadata = function (metadata, subscription_id) {
        var _this = this;
        this.metadata = metadata;
        // distribute the update to all subscribers except the one that sent it
        var updateReceivers = subscription_id ?
            Object.keys(this.subscribers).filter(function (subscriber_id) { return subscriber_id !== subscription_id; })
            : Object.keys(this.subscribers);
        updateReceivers.forEach(function (subscriber_id) {
            var subscriber = _this.subscribers[subscriber_id];
            var receiveUpdateMetadata = {
                subscription_id: subscriber_id,
                metadata: metadata,
            };
            _this.addToWorkload(createUnit(subscriber.instance, {
                receiveUpdateMetadata: receiveUpdateMetadata,
            }));
        });
    };
    Asset.prototype.receiveDelete = function (subscription_id) {
        var _this = this;
        // distribute the delete notification to all subscribers
        // except the one that sent it
        var otherSubscribers = Object.keys(this.subscribers).filter(function (subscriber_id) { return subscriber_id !== subscription_id; });
        otherSubscribers.forEach(function (subscriber_id) {
            var subscriber = _this.subscribers[subscriber_id];
            var deleteNotification = {
                subscription_id: subscription_id,
            };
            _this.addToWorkload(createUnit(subscriber.instance, {
                deleteNotification: deleteNotification,
            }));
        });
        // sever connection to the asset maintainer
        this.addToWorkload({
            type: "terminate",
            instance: this.maintainer,
        });
    };
    Asset.prototype.subscribe = function (instance, options) {
        this.subscribers[options.subscription_id] = {
            instance: instance,
        };
        console.log("subscribe", options);
        var subscriptionConfirmation = {
            asset_id: this.id,
            subscription_id: options.subscription_id
        };
        // push a confirmation to the subscriber
        this.addToWorkload(createUnit(instance, {
            subscriptionConfirmation: subscriptionConfirmation,
        }));
        // if the subscriber has requested the initial state, send it
        if (options.receive_initial_state) {
            this.readAsset(options.subscription_id);
        }
    };
    Asset.prototype.unsubscribe = function (subscriber_id) {
        var instance = this.subscribers[subscriber_id].instance;
        if (this.subscribers[subscriber_id]) {
            delete this.subscribers[subscriber_id];
        }
        // push a confirmation to the subscriber
        var unsubscribeConfirmation = {
            subscription_id: subscriber_id
        };
        this.addToWorkload(createUnit(instance, {
            unsubscribeConfirmation: unsubscribeConfirmation,
        }));
    };
    return Asset;
}());

var IndexAsset = /** @class */ (function (_super) {
    __extends(IndexAsset, _super);
    function IndexAsset(addToWorkload) {
        return _super.call(this, {
            data: {},
            metadata: {},
            on_update: {
                type: "simple",
            },
            id: "index",
        }, addToWorkload) || this;
    }
    return IndexAsset;
}(Asset));
var AssetServer = /** @class */ (function () {
    function AssetServer(addToWorkload) {
        this.assets = [];
        this.addToWorkload = addToWorkload;
        // Initialize the asset server
        this.assets.push(new IndexAsset(this.addToWorkload.bind(this)));
    }
    AssetServer.prototype.loadAssets = function (assets) {
        var _a;
        var _this = this;
        (_a = this.assets).push.apply(_a, assets.map(function (asset) { return new Asset(asset, _this.addToWorkload.bind(_this)); }));
        this.updateIndexAsset();
    };
    AssetServer.prototype.saveAssets = function () {
        var dirtyAssetExists = this.assets.some(function (asset) { return asset.dirty; });
        if (dirtyAssetExists) {
            this.assets.forEach(function (asset) {
                if (asset.dirty)
                    asset.sync();
            });
            return;
        }
        var assets = this.assets.filter(function (asset) { return asset.id !== "index"; }).map(function (asset) { return asset.serialize(); });
        return assets;
    };
    AssetServer.prototype.updateIndexAsset = function () {
        var indexAsset = this.assets.find(function (asset) { return asset.id === "index"; });
        if (indexAsset) {
            var newIndexData_1 = {};
            this.assets.filter(function (asset) { return asset.id !== "index"; }).forEach(function (asset) {
                newIndexData_1[asset.id] = asset.metadata;
            });
            indexAsset.receiveUpdate(newIndexData_1);
        }
    };
    AssetServer.prototype.createAsset = function (instance, asset, subscription_name) {
        var newAsset = new Asset(asset, this.addToWorkload.bind(this), subscription_name ? instance : undefined, subscription_name);
        this.assets.push(newAsset);
        // newAsset.subscribe(instance,{
        //     receive_initial_state: false,
        //     subscription_name,
        // })
        this.updateIndexAsset();
    };
    AssetServer.prototype.subscribeToExistingAsset = function (instance, assetId, subscription_id) {
        var asset = this.assets.find(function (asset) { return asset.id === assetId; });
        if (asset) {
            asset.subscribe(instance, {
                receive_initial_state: true,
                subscription_id: subscription_id,
            });
            return;
        }
        throw new Error("Asset with id ".concat(assetId, " not found"));
    };
    AssetServer.prototype.unsubscribeFromAsset = function (assetId, subscription_id) {
        var asset = this.assets.find(function (asset) { return asset.id === assetId; });
        if (asset) {
            asset.unsubscribe(subscription_id);
        }
    };
    AssetServer.prototype.updateAsset = function (assetId, update, subscription_id) {
        var asset = this.assets.find(function (asset) { return asset.id === assetId; });
        //console.log("updateAsset", assetId, update, subscription_id);
        if (asset) {
            asset.receiveUpdate(update, subscription_id);
        }
    };
    AssetServer.prototype.updateAssetMetadata = function (assetId, metadata, subscription_id) {
        var asset = this.assets.find(function (asset) { return asset.id === assetId; });
        if (asset) {
            asset.receiveUpdateMetadata(metadata, subscription_id);
            this.updateIndexAsset();
        }
    };
    AssetServer.prototype.maintainerUpdateResponse = function (assetId, update) {
        var asset = this.assets.find(function (asset) { return asset.id === assetId; });
        if (asset) {
            asset.receiveUpdateFromMaintainer(update);
        }
    };
    AssetServer.prototype.deleteAsset = function (assetId, subscription_id) {
        var asset = this.assets.find(function (asset) { return asset.id === assetId; });
        if (asset) {
            asset.receiveDelete(subscription_id);
            this.assets = this.assets.filter(function (a) { return a.id !== assetId; });
            this.updateIndexAsset();
        }
    };
    return AssetServer;
}());

var workload = {};
function addToWorkload(unit) {
    var existingUnits = workload.assetServer || [];
    workload = {
        assetServer: __spreadArray(__spreadArray([], existingUnits, true), [unit], false)
    };
}
function clearWorkload() {
    workload = {};
}
var assetServer = new AssetServer(addToWorkload);
var savedKey;
var awaitingSave = false;
function onCompute(string) {
    string = decodeURI(string);
    var unit = JSON.parse(string);
    var _a = unit.payload, SAVE_SESSION = _a.SAVE_SESSION, LOAD_SESSION = _a.LOAD_SESSION, key = _a.key, state = _a.state, createAsset = _a.createAsset, subscribeToExistingAsset = _a.subscribeToExistingAsset, unsubscribeFromAsset = _a.unsubscribeFromAsset, updateAsset = _a.updateAsset, deleteAsset = _a.deleteAsset, updateAssetMetadata = _a.updateAssetMetadata, maintainerUpdateResponse = _a.maintainerUpdateResponse;
    if (SAVE_SESSION) {
        var savedAssets = assetServer.saveAssets();
        if (savedAssets === undefined) {
            savedKey = key;
            awaitingSave = true;
            var currentWorkload = workload;
            clearWorkload();
            return currentWorkload;
        }
        return {
            persistence: [{
                    type: "worker",
                    receiver: unit.sender,
                    payload: {
                        key: key,
                        SAVE_SESSION: SAVE_SESSION,
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
        var asset = createAsset.asset, subscription_name = createAsset.subscription_name;
        assetServer.createAsset(unit.sender, asset, subscription_name);
        var currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }
    if (subscribeToExistingAsset) {
        var asset_id = subscribeToExistingAsset.asset_id, subscription_id = subscribeToExistingAsset.subscription_id;
        assetServer.subscribeToExistingAsset(unit.sender, asset_id, subscription_id);
        var currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }
    if (unsubscribeFromAsset) {
        var asset_id = unsubscribeFromAsset.asset_id, subscription_id = unsubscribeFromAsset.subscription_id;
        assetServer.unsubscribeFromAsset(asset_id, subscription_id);
        var currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }
    if (updateAsset) {
        var asset_id = updateAsset.asset_id, update = updateAsset.update, subscription_id = updateAsset.subscription_id;
        assetServer.updateAsset(asset_id, update, subscription_id);
        var currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }
    if (updateAssetMetadata) {
        var asset_id = updateAssetMetadata.asset_id, metadata = updateAssetMetadata.metadata, subscription_id = updateAssetMetadata.subscription_id;
        assetServer.updateAssetMetadata(asset_id, metadata, subscription_id);
        var currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }
    if (deleteAsset) {
        var asset_id = deleteAsset.asset_id, subscription_id = deleteAsset.subscription_id;
        assetServer.deleteAsset(asset_id, subscription_id);
        var currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }
    if (maintainerUpdateResponse) {
        var asset_id = maintainerUpdateResponse.asset_id;
        assetServer.maintainerUpdateResponse(asset_id, maintainerUpdateResponse);
        if (awaitingSave) {
            var savedAssets = assetServer.saveAssets();
            if (savedAssets !== undefined) {
                addToWorkload({
                    type: "worker",
                    receiver: {
                        instance_id: "persistence",
                        resource_id: "persistence",
                        modality: "persistence"
                    },
                    payload: {
                        key: savedKey,
                        SAVE_SESSION: true,
                        state: assetServer.saveAssets(),
                    }
                });
                awaitingSave = false;
                savedKey = undefined;
            }
        }
        var currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
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
