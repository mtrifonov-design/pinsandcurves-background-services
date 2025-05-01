
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


    constructor(sa: SerialisedAsset, addToWorkload: (unit:any) => void) {
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
            }
            this.addToWorkload(
                createUnit(this.maintainer, {
                    init: this.data,
                })
            );
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
            this._dirty = false;
        }
    }

    pending_read_requests: {
        [key: string]: string
    } = {};
    readAsset(subscription_id: string) {
        if (this.dirty) {
            if (!this.maintainer) {
                throw new Error("Asset is dirty but has no maintainer");
            }
            // send outstanding updates to asset maintainer
            const requestId = randomUUID();
            this.addToWorkload(
                createUnit(this.maintainer, {
                    request: "update",
                    updates: this.outstanding_updates,
                    requestId,
                })
            );
            this.outstanding_updates = [];
            // queue this get request

            this.pending_read_requests[requestId] = subscription_id;
        } else {
            // answer the request
            const subscriber = this.subscribers[subscription_id];
            const getAssetResponse = {
                asset_id: this.id,
                asset_data: this.data,
                asset_metadata: this.metadata,
            }
            this.addToWorkload(
                createUnit(subscriber.instance, {
                    getAssetResponse,
                })
            );
        }
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
        this.dirty = false;
        const { requestId, asset_data } = payload;
        // answer the request
        const subscriber_id = this.pending_read_requests[requestId];
        this.readAsset(subscriber_id);
        delete this.pending_read_requests[requestId];
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
            asset_id: this.id,
            update,
        }
        this.addToWorkload(
            createUnit(subscriber.instance, {
                receiveUpdate,
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
                asset_id: this.id,
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
        if (this.subscribers[subscriber_id]) {
            delete this.subscribers[subscriber_id];
        }
        // push a confirmation to the subscriber
        const unsubscribeConfirmation = {
            subscription_id: subscriber_id
        };
        this.addToWorkload(
            createUnit(this.subscribers[subscriber_id].instance, {
                unsubscribeConfirmation,
            })
        );
    }


}

export { Asset, SerialisedAsset };