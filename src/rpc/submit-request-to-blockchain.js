"use strict";

var stripReturnsTypeAndInvocation = require("../encode-request/strip-returns-type-and-invocation");
var isFunction = require("../utils/is-function");

/**
 * Used internally.  Submits a remote procedure call to the blockchain.
 *
 * @param {!object} jso - The JSON-RPC call to make.
 * @param {?string} transportRequirements - ANY, SYNC or DUPLEX.  Will choose best available transport that meets the requirements.
 * @param {?function(?Error, ?object):void} callback - Called when a response to the request is received.  May only be null if preferredTransport is SYNC.
 * @returns {void|?Error|?object} - Returns the error or result if the operation is synchronous.
 */
function submitRequestToBlockchain(jso, transportRequirements, callback) {
  return function (dispatch, getState) {
    var syncErrorOrResult, expectedReturnTypes, transporter;
    transporter = getState().transporter;

    if (transportRequirements === "SYNC") {
      callback = function (error, result) {
        return (syncErrorOrResult = (error || result));
      };
    }

    if (isFunction(transportRequirements) && !callback) {
      callback = transportRequirements;
      transportRequirements = null;
    }

    if (!isFunction(callback)) throw new Error("callback must be a function");
    if (typeof transportRequirements !== "string" && transportRequirements !== null) {
      return callback(new Error("transportRequirements must be null or a string"));
    }
    if (typeof jso !== "object") return callback(new Error("jso must be an object"));
    if (typeof jso.id !== "number") return callback(new Error("jso.id must be a number"));

    // FIXME: return types shouldn't be embedded into the RPC JSO
    expectedReturnTypes = stripReturnsTypeAndInvocation(jso);
    dispatch({
      type: "ADD_OUTSTANDING_REQUEST",
      id: jso.id,
      request: {
        jso: jso,
        expectedReturnTypes: expectedReturnTypes,
        callback: callback
      }
    });

    transporter.blockchainRpc(jso, transportRequirements, this.debug.broadcast);

    if (transportRequirements === "SYNC") {
      if (typeof getState().outstandingRequests[jso.id] !== "undefined") {
        return new Error("SYNC request didn't receive messageHandler call before returning.");
      }
      return syncErrorOrResult;
    }
  };
}

module.exports = submitRequestToBlockchain;
