/**
 * A helper class to manage port assignment for Jekyll instances. This doesn't actually create the Jekyll server, it just organized what ports are in use.
 */
class PortManager {
    /**
     * Create a port manager instance
     * @param {Number} minPort The lowest port number to be assigned (min 1)
     * @param {Number} maxPort The highest port number to be assigned (max 65535)
     * @param {Number} [maxConsecutive=Infinity] The maximum number of consecutive ports that can be open at one time. Defaults to unlimited. (min 1), 0 is unlimited
     */
    constructor(minPort, maxPort, maxConsecutive = Infinity) {
        if (isNaN(parseInt(minPort)) || isNaN(parseInt(maxPort)) || isNaN(parseInt(maxConsecutive))) {
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
    }

    /**
     * An object of bound ports and what they are bound to
     * @type {Object.<number, any>}
     */
    assignments = {}

    /**
     * Check if a given port number is outside of the range of allowed ports
     * @param {Number} portNumber 
     */
    checkInRange(portNumber) {
        if (portNumber > this.maxPort || portNumber < this.minPort) {
            return portNumber
        }
    }

    /**
     * Check if a given port number is in use by another instance. 
     * @param {C} portNumber 
     * @returns {Boolean} true if port is unassigned, false otherwise or if out of range
     */
    checkIfAvailable(portNumber) {
        if (this.checkInRange(portNumber)) {
            return (this.assignments[portNumber] === undefined)
        } else {
            return false
        }
    }

    /**
     * Get what a given port number is bound to. Returns undefined if port is not assigned
     * @param {Number} portNumber 
     */
    getBinding(portNumber) {
        return this.assignments[portNumber] ?? undefined
    }

    /**
     * Check if current active port count is at the maximum
     * @returns {Boolean} true if under maximum
     */
    underMaxConsecutive() {
        if (Object.keys(this.BoundTo).length >= this.maxConsecutive) {
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
    bindAuto(ToBind) {
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
     * @param {Number} portNumber The number of port to bind
     * @param {*} ToBind What is using the port
     * @returns {Number} The bound port number. Throws Error if port in use, or if max consecutive ports is reached
     */
    bindManual(portNumber, ToBind) {
        if (!this.underMaxConsecutive()) {
            throw Error("[bindAuto] Max consecutive assignments reached! Release stale instances before binding more ports.")
        }

        if (!this.checkInRange(portNumber)) {
            throw Error("[bindManual] Requested port is out of range!")
        }

        if (this.checkIfAvailable(portNumber)) {
            this.assignments[portNumber] = ToBind

            return true
        } else {
            throw Error("[bindManual] Requested port is in use!")
        }
    }

    /**
     * Release a port number. Make sure that whatever was using the port is definitely not using it anymore!
     * @param {Number} portNumber 
     * @returns {Boolean} true if port released
     */
    release(portNumber) {
        if (this.assignments[portNumber] === undefined) {
            throw Error("[release] Port to released not assigned!")
        }

        delete this.assignments[portNumber]

        return true
    }
}

module.exports = PortManager