
type OnUpdate =
| {
    type: 'simple';
}
| {
    type: 'custom';
    processor: {
        resource_id: string;
        modality: string;
    };
};

type Instance = {
    instance_id: string;
    resource_id: string;
    modality: string;
}

type SerialisedAsset = {
    id: string;
    data: any;
    metadata: any;
    on_update: OnUpdate;
}

type SubscribeConfirmation = {
    subscription_id: string;
    subscription_name: string;
    asset_id: string;
}

type SubscribeOptions = {
    subscription_name: string;
    receive_initial_state?: boolean;
}

function createUnit(receiver: Instance, payload: any) {
    return {
        type: "worker",
        receiver,
        payload
    };
}

class Asset {
    id: string;
    _dirty: boolean = false;
    data: any;
    metadata: any;
    on_update: OnUpdate;
    maintainer: {
        instance_id: string;
        resource_id: string;
        modality: string;
    } | undefined;
    addToWorkload: (unit:any) => void;


    constructor(sa: Omit<SerialisedAsset,"id">, addToWorkload: (unit:any) => void, instance?: Instance, subscription_name?: string) {
        this.id = randomUUID();
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
            }
            this.addToWorkload(
                createUnit(this.maintainer, {
                    init: this.data,
                })
            );
            if (instance && subscription_name) {
                this.subscribe(instance, {
                    receive_initial_state: false,
                    subscription_name: subscription_name,
                });
            }
        }
    }

    get dirty() {
        return this._dirty;
    }
    set dirty(val: boolean) {
        // only allow setting dirty to true if the asset is externally maintained
        if (val) {
            if (this.on_update.type === 'simple') {
                return;
            } else {

                this._dirty = true;
            }
        } else {
            if (Object.keys(this.pending_requests).length > 0) return;
            this._dirty = false;
        }
    }

    pending_requests: {
        [key: string]: {
            subscription_id?: string;
            type: 'read' | 'sync';
        }
    } = {};
    readAsset(subscription_id: string) {
        if (this.dirty) {
            // if (!this.maintainer) {
            //     throw new Error("Asset is dirty but has no maintainer");
            // }
            // // send outstanding updates to asset maintainer
            // const request_id = randomUUID();
            // this.addToWorkload(
            //     createUnit(this.maintainer, {
            //         processUpdates: { 
            //             updates: this.outstanding_updates,
            //             request_id, 
            //             asset_id: this.id,
            //         }
            //     })
            // );
            // this.outstanding_updates = [];
            // // queue this get request
            const request_id = this.pushOutstandingUpdates();
            this.pending_requests[request_id] = {
                subscription_id,
                type: 'read',
            };
        } else {
            // answer the request
            const subscriber = this.subscribers[subscription_id];
            const getAssetResponse = {
                subscription_id,
                asset_id: this.id,
                asset_data: this.data,
            }
            this.addToWorkload(
                createUnit(subscriber.instance, {
                    getAssetResponse,
                })
            );
        }
    }

    sync() {
        if (this.dirty) {
            const request_id = this.pushOutstandingUpdates();
            this.pending_requests[request_id] = {
                type: 'sync',
            };
        }
    }

    pushOutstandingUpdates() : string  {
        if (this.dirty) {
            if (!this.maintainer) {
                throw new Error("Asset is dirty but has no maintainer");
            }
            // send outstanding updates to asset maintainer
            const request_id = randomUUID();
            this.addToWorkload(
                createUnit(this.maintainer, {
                    processUpdates: { 
                        updates: this.outstanding_updates,
                        asset_id: this.id,
                        request_id,
                    }
                })
            );
            this.outstanding_updates = [];
            return request_id;
        }
        throw new Error("Asset is not dirty");
    }

    serialize(): SerialisedAsset {
        return {
            id: this.id,
            data: this.data,
            metadata: this.metadata,
            on_update: this.on_update,
        }
    }

    receiveUpdateFromMaintainer(payload: any) {
        
        const { request_id, asset_data } = payload;
        // update the asset data
        this.data = asset_data;
        // answer the request
        const {subscription_id,type} = this.pending_requests[request_id];
        if (type === "read") this.readAsset(subscription_id as string);
        delete this.pending_requests[request_id];
        this.dirty = false;
    }

    outstanding_updates: any[] = [];
    receiveUpdate(update: any, subscription_id?: string) {
        if (this.on_update.type === 'simple') {
            this.data = update;
        } else {
            this.dirty = true;
            this.outstanding_updates.push(update);
        }
        // distribute the update to all subscribers except the one that sent it
        const updateReceivers = subscription_id ?
            Object.keys(this.subscribers).filter(subscriber_id => subscriber_id !== subscription_id)
            : Object.keys(this.subscribers);
        updateReceivers.forEach(subscriber_id => {
        const subscriber = this.subscribers[subscriber_id];

        const receiveUpdate = {
            subscription_id: subscriber_id,
            update,
        }
        this.addToWorkload(
            createUnit(subscriber.instance, {
                receiveUpdate,
            })
        );
        });
    }

    receiveUpdateMetadata(metadata: any, subscription_id?: string) {
        this.metadata = metadata;
        // distribute the update to all subscribers except the one that sent it
        const updateReceivers = subscription_id ?
            Object.keys(this.subscribers).filter(subscriber_id => subscriber_id !== subscription_id)
            : Object.keys(this.subscribers);
        updateReceivers.forEach(subscriber_id => {
        const subscriber = this.subscribers[subscriber_id];

        const receiveUpdateMetadata = {
            subscription_id: subscriber_id,
            metadata,
        }
        this.addToWorkload(
            createUnit(subscriber.instance, {
                receiveUpdateMetadata,
            })
        );
        });
    }

    receiveDelete(subscription_id: string) {
        // distribute the delete notification to all subscribers
        // except the one that sent it
        const otherSubscribers = Object.keys(this.subscribers).filter(subscriber_id => subscriber_id !== subscription_id);
        otherSubscribers.forEach(subscriber_id => {
            const subscriber = this.subscribers[subscriber_id];
            const deleteNotification = {
                subscription_id,
            }
            this.addToWorkload(
                createUnit(subscriber.instance, {
                    deleteNotification,
                })
            );
        });

        // sever connection to the asset maintainer
        this.addToWorkload(
            {
                type: "terminate",
                instance: this.maintainer,
            }
        );
    }

    subscribers: { [subscriber_id: string]: {
        instance: Instance;
    } } = {};

    subscribe(instance: Instance, options: SubscribeOptions) {
        const subscription_id = randomUUID();
        this.subscribers[subscription_id] = {
            instance: instance,
        };

        const subscriptionConfirmation: SubscribeConfirmation = {
            subscription_id,
            asset_id: this.id,
            subscription_name: options.subscription_name
        };
        // push a confirmation to the subscriber
        this.addToWorkload(
            createUnit(instance, {
                subscriptionConfirmation,
            })
        );

        // if the subscriber has requested the initial state, send it
        if (options.receive_initial_state) {
            this.readAsset(subscription_id);
        }
    }
    unsubscribe(subscriber_id: string) {
        const instance = this.subscribers[subscriber_id].instance;
        if (this.subscribers[subscriber_id]) {
            delete this.subscribers[subscriber_id];
        }
        // push a confirmation to the subscriber
        const unsubscribeConfirmation = {
            subscription_id: subscriber_id
        };
        this.addToWorkload(
            createUnit(instance, {
                unsubscribeConfirmation,
            })
        );
    }


}

export { Asset };
export type { SerialisedAsset }