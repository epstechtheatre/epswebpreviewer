/**
 * A helper class to manage port assignment for Jekyll instances. This doesn't actually create the Jekyll server, it just organized what ports are in use.
 */
export default class PortManager {
    Parent: import("../index").Main
    minPort: number
    maxPort: number
    maxConsecutive: number


    constructor(Parent: import("../index").Main, minPort: number, maxPort: number, maxConsecutive:number = Infinity) {
        if (isNaN(minPort) || isNaN(maxPort) || isNaN(maxConsecutive)) {
            throw Error("[PortManager] non-number provided!")
        }

        if (minPort < 1 || maxPort > 65535) {
            throw Error("[PortManager] invalid port range!")
        }

        if (maxConsecutive === 0) {
            maxConsecutive = Infinity
        }

        if (maxConsecutive < 0) {
            throw Error("[PortManager] invalid consecutive assignment!")
        }

        this.minPort = minPort
        this.maxPort = maxPort
        this.maxConsecutive = maxConsecutive
        this.Parent = Parent
    }

    /**
     * An object of bound ports and what they are bound to
     */
    assignments: {[key: number]: any} = {}

    /**
     * Check if a given port number is outside of the range of allowed ports
     */
    checkInRange(portNumber: number): boolean {
        if (portNumber > this.maxPort || portNumber < this.minPort) {
            return false
        } else {
            return true
        }
    }

    /**
     * Check if a given port number is in use by another instance. 
     */
    checkIfAvailable(portNumber: number): boolean {
        if (this.checkInRange(portNumber)) {
            return (this.assignments[portNumber] === undefined)
        } else {
            return false
        }
    }

    /**
     * Get what a given port number is bound to. Returns undefined if port is not assigned
     */
    getBinding(portNumber: number) {
        return this.assignments[portNumber] ?? undefined
    }

    /**
     * Check if current active port count is at the maximum
     * @returns {Boolean} true if under maximum
     */
    underMaxConsecutive() {
        if (Object.keys(this.assignments).length >= this.maxConsecutive) {
            return false
        } else {
            return true
        }
    }

    /**
     * Find the next unused port and bind to it
     * @param {*} ToBind What is using the port
     * @returns {Number} The port the Instance was bound to. Throws error if all ports in use
     */
    bindAuto(ToBind: any): number {
        if (!this.underMaxConsecutive()) {
            throw Error("[bindAuto] Max consecutive assignments reached! Release stale instances before binding more ports.")
        }

        for (let i = this.minPort; i < this.maxPort; i++) {
            if (this.assignments[i] === undefined) {
                //Found an used port
                this.assignments[i] = ToBind

                return i
            }
        }

        //If we made it here, all ports are in use
        throw Error("[bindAuto] All ports in range are in use! Release stale instances before binding more ports.")
    }

    /**
     * Manual assign a port ID and a binding.
     */
    bindManual(portNumber: number, ToBind: any): number {
        if (!this.underMaxConsecutive()) {
            throw Error("[bindAuto] Max consecutive assignments reached! Release stale instances before binding more ports.")
        }

        if (!this.checkInRange(portNumber)) {
            throw Error("[bindManual] Requested port is out of range!")
        }

        if (this.checkIfAvailable(portNumber)) {
            this.assignments[portNumber] = ToBind

            return portNumber
        } else {
            throw Error("[bindManual] Requested port is in use!")
        }
    }

    /**
     * Release a port number. Make sure that whatever was using the port is definitely not using it anymore!
     * @returns {Boolean} true if port released
     */
    release(portNumber: number) {
        if (this.assignments[portNumber] === undefined) {
            throw Error("[release] Port to released not assigned!")
        }

        delete this.assignments[portNumber]

        return true
    }
}