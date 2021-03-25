import crypto from "crypto"
import express from "express"

type registeredListeners = {
    [key: string]: WebhookListener
}

export interface WebhookCallback { (Main: import("../index").Main, reqBody: express.Request["body"]): void }
export default class WebhookManager {
    registeredListeners: registeredListeners = {}
    Parent: import("../index").Main

    /**
     * Instantiate a webhook event that should be listened for
     */
    constructor(Parent: import("../index").Main) {
        this.Parent = Parent

        return this
    }

    public addListener(eventHeader: string, callback: WebhookCallback, processDelay: number = 0) {
        this.registeredListeners[eventHeader] = new WebhookListener(this, eventHeader, callback, processDelay)

        return this
    }

    /**
     * Check an incoming request to see if it is a webhook that is processable 
     */
    public checkIncoming(req: express.Request):void {
        var incomingType: string;

        if (req.headers["x-github-event"] && !Array.isArray(req.headers["x-github-event"])) {
            incomingType = req.headers["x-github-event"]
        } else {

            //I don't know what this is but it's wrong
            console.warn("Received a non-Github post")
            return
        }

        if (this.registeredListeners[incomingType]) {
            this.processIncoming(req, incomingType)

        } else {
            console.warn("Received a non-tracked Github post")
        }
    }

    private async processIncoming(req: express.Request, indexer: string):Promise<void> {
        //First let's check if the webhook has our secret. If it does then we know this is a legitimate webhook call (and not a spoof)
        if (this.validateSHA(req)) {
            
            if (this.registeredListeners[indexer].processDelay > 0) {
                await this.registeredListeners[indexer].delay()
            }

            this.registeredListeners[indexer].callback(this.Parent, req.body)
        }
    }

    private validateSHA(req: express.Request): boolean {
        //Using our copy of the secret, let's create a hash and see if the results line up
        const expectedSignature = `sha256=${crypto.createHmac("sha256", this.Parent.authData.webhookSecret).update(JSON.stringify(req.body)).digest("hex")}` 

        if (req.headers["x-hub-signature-256"] === expectedSignature) {
            //Great we can proceed
            return true
        } else {

            //Uh oh, best we just ignore this then
            return false
        }
    }
}

class WebhookListener {
    eventHeader: string
    callback: WebhookCallback
    processDelay: number

    constructor(Parent: WebhookManager, eventHeader: string, callback: WebhookCallback, processDelay: number = 0) {
        this.eventHeader = eventHeader //The string to check for to match what type of webhook is coming in
        this.callback = callback //The callback for processing
        this.processDelay = processDelay //How long to wait IN MILLISECONDS before calling the callback

        return this
    }

    public delay(): Promise<boolean> {
        const _this = this //Entering new scope

        return new Promise(async function(resolve) {
            setTimeout(() => {
                resolve(true)
            }, _this.processDelay)
        })
    }
}