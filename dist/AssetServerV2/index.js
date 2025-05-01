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
    function Asset(sa, addToWorkload) {
        this._dirty = false;
        this.pending_read_requests = {};
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
                instance_id: randomUUID(),
                resource_id: this.on_update.processor.resource_id,
                modality: this.on_update.processor.modality,
            };
            this.addToWorkload(createUnit(this.maintainer, {
                init: this.data,
            }));
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
                this._dirty = false;
            }
        },
        enumerable: false,
        configurable: true
    });
    Asset.prototype.readAsset = function (subscription_id) {
        if (this.dirty) {
            if (!this.maintainer) {
                throw new Error("Asset is dirty but has no maintainer");
            }
            // send outstanding updates to asset maintainer
            var requestId = randomUUID();
            this.addToWorkload(createUnit(this.maintainer, {
                request: "update",
                updates: this.outstanding_updates,
                requestId: requestId,
            }));
            this.outstanding_updates = [];
            // queue this get request
            this.pending_read_requests[requestId] = subscription_id;
        }
        else {
            // answer the request
            var subscriber = this.subscribers[subscription_id];
            var getAssetResponse = {
                asset_id: this.id,
                asset_data: this.data,
                asset_metadata: this.metadata,
            };
            this.addToWorkload(createUnit(subscriber.instance, {
                getAssetResponse: getAssetResponse,
            }));
        }
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
        this.dirty = false;
        var requestId = payload.requestId; payload.asset_data;
        // answer the request
        var subscriber_id = this.pending_read_requests[requestId];
        this.readAsset(subscriber_id);
        delete this.pending_read_requests[requestId];
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
        var updateReceivers = subscription_id ?
            Object.keys(this.subscribers).filter(function (subscriber_id) { return subscriber_id !== subscription_id; })
            : Object.keys(this.subscribers);
        updateReceivers.forEach(function (subscriber_id) {
            var subscriber = _this.subscribers[subscriber_id];
            var receiveUpdate = {
                asset_id: _this.id,
                update: update,
            };
            _this.addToWorkload(createUnit(subscriber.instance, {
                receiveUpdate: receiveUpdate,
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
                asset_id: _this.id,
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
        var subscription_id = randomUUID();
        this.subscribers[subscription_id] = {
            instance: instance,
        };
        var subscriptionConfirmation = {
            subscription_id: subscription_id,
            subscription_name: options.subscription_name
        };
        // push a confirmation to the subscriber
        this.addToWorkload(createUnit(instance, {
            subscriptionConfirmation: subscriptionConfirmation,
        }));
        // if the subscriber has requested the initial state, send it
        if (options.receive_initial_state) {
            this.readAsset(subscription_id);
        }
    };
    Asset.prototype.unsubscribe = function (subscriber_id) {
        if (this.subscribers[subscriber_id]) {
            delete this.subscribers[subscriber_id];
        }
        // push a confirmation to the subscriber
        var unsubscribeConfirmation = {
            subscription_id: subscriber_id
        };
        this.addToWorkload(createUnit(this.subscribers[subscriber_id].instance, {
            unsubscribeConfirmation: unsubscribeConfirmation,
        }));
    };
    return Asset;
}());

var IndexAsset = /** @class */ (function (_super) {
    __extends(IndexAsset, _super);
    function IndexAsset(addToWorkload) {
        return _super.call(this, {
            id: "index",
            data: {},
            metadata: {},
            on_update: {
                type: "simple",
            }
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
        var newAsset = new Asset(asset, this.addToWorkload.bind(this));
        this.assets.push(newAsset);
        newAsset.subscribe(instance, {
            receive_initial_state: false,
            subscription_name: subscription_name,
        });
        this.updateIndexAsset();
    };
    AssetServer.prototype.subscribeToExistingAsset = function (instance, assetId, subscription_name) {
        var asset = this.assets.find(function (asset) { return asset.id === assetId; });
        if (asset) {
            asset.subscribe(instance, {
                receive_initial_state: true,
                subscription_name: subscription_name,
            });
        }
    };
    AssetServer.prototype.updateAsset = function (assetId, update, subscription_id) {
        var asset = this.assets.find(function (asset) { return asset.id === assetId; });
        if (asset) {
            asset.receiveUpdate(update, subscription_id);
        }
    };
    AssetServer.prototype.deleteAsset = function (assetId, subscription_id) {
        var asset = this.assets.find(function (asset) { return asset.id === assetId; });
        if (asset) {
            asset.receiveDelete(subscription_id);
            this.assets = this.assets.filter(function (a) { return a.id !== assetId; });
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
function onCompute(string) {
    string = decodeURI(string);
    var unit = JSON.parse(string);
    var _a = unit.payload, SAVE_SESSION = _a.SAVE_SESSION, LOAD_SESSION = _a.LOAD_SESSION, key = _a.key, state = _a.state, createAsset = _a.createAsset, subscribeToExistingAsset = _a.subscribeToExistingAsset, updateAsset = _a.updateAsset, deleteAsset = _a.deleteAsset;
    if (SAVE_SESSION) {
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
        var assetId = subscribeToExistingAsset.assetId, subscription_name = subscribeToExistingAsset.subscription_name;
        assetServer.subscribeToExistingAsset(unit.sender, assetId, subscription_name);
        var currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }
    if (updateAsset) {
        var assetId = updateAsset.assetId, update = updateAsset.update, subscription_id = updateAsset.subscription_id;
        assetServer.updateAsset(assetId, update, subscription_id);
        var currentWorkload = workload;
        clearWorkload();
        return currentWorkload;
    }
    if (deleteAsset) {
        var assetId = deleteAsset.assetId, subscription_id = deleteAsset.subscription_id;
        assetServer.deleteAsset(assetId, subscription_id);
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
