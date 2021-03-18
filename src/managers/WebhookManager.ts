import {webhookSecret} from "../../auth.json"
import crypto from "crypto"
import express from "express"

type registeredListeners = {
    [key: string]: WebhookListener
}

interface WebhookCallback { (Main: import("../index").Main, reqBody: express.Request["body"]): void }
export default class WebhookListener {
    static registeredListeners: registeredListeners = {}

    static processIncoming(req: express.Request) {
        var incomingType: string;

        if (req.headers["x-github-event"] && !Array.isArray(req.headers["x-github-event"])) {
            incomingType = req.headers["x-github-event"]
        } else {

            //I don't know what this is but it's wrong
            console.warn("Received a non-Github post")
            return
        }

        if (this.registeredListeners[incomingType]) {
            this.registeredListeners[incomingType].processIncoming(req)

        } else {
            console.warn("Received a non-tracked Github post")
        }
    }

    eventHeader: string
    callback: WebhookCallback
    processDelay: number
    Parent: import("../index").Main

    /**
     * Instantiate a webhook event that should be listened for
     */
    constructor(Parent: import("../index").Main, eventHeader: string, callback: WebhookCallback, processDelay: number = 0) {
        this.eventHeader = eventHeader //The string to check for to match what type of webhook is coming in
        this.callback = callback //The callback for processing
        this.processDelay = processDelay //How long to wait IN MILLISECONDS before calling the callback
        this.Parent = Parent
        
        WebhookListener.registeredListeners[eventHeader] = this

        return this
    }

    public async processIncoming(req: express.Request) {
        //First let's check if the webhook has our secret. If it does then we know this is a legitimate webhook call (and not a spoof)
        if (this.validateSHA(req)) {
            
            if (this.processDelay > 0) {
                await this.delay()
            }

            this.callback(this.Parent, req.body)
        }
    }

    private validateSHA(req: express.Request): boolean {
        //Using our copy of the secret, let's create a hash and see if the results line up
        const expectedSignature = `sha256=${crypto.createHmac("sha256", webhookSecret).update(JSON.stringify(req.body)).digest("hex")}` 

        if (req.headers["x-hub-signature-256"] === expectedSignature) {
            //Great we can proceed
            return true
        } else {

            //Uh oh, best we just ignore this then
            return false
        }
    }

    private delay(): Promise<boolean> {
        const _this = this //Entering new scope

        return new Promise(async function(resolve) {
            setTimeout(() => {
                resolve(true)
            }, _this.processDelay)
        })
    }
}