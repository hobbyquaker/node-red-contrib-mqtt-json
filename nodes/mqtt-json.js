/**
 * Copyright JS Foundation and other contributors, http://js.foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 **/

module.exports = function (RED) {
    'use strict';
    const oe = require('obj-ease');
    const isUtf8 = require('is-utf8');

    function MQTTJSONInNode(config) {
        RED.nodes.createNode(this, config);
        this.topic = config.topic;
        this.qos = parseInt(config.qos, 10);
        if (isNaN(this.qos) || this.qos < 0 || this.qos > 2) {
            this.qos = 2;
        }
        this.broker = config.broker;
        this.brokerConn = RED.nodes.getNode(this.broker);
        if (!/^(#$|(\+|[^+#]*)(\/(\+|[^+#]*))*(\/(\+|#|[^+#]*))?$)/.test(this.topic)) {
            return this.warn(RED._('mqtt.errors.invalid-topic'));
        }
        const node = this;
        if (this.brokerConn) {
            this.status({fill: 'red', shape: 'ring', text: 'node-red:common.status.disconnected'});
            if (this.topic) {
                node.brokerConn.register(this);
                this.brokerConn.subscribe(this.topic, this.qos, (topic, payload, packet) => {
                    let parsed;
                    if (isUtf8(payload)) {
                        payload = payload.toString();
                        try {
                            parsed = JSON.parse(payload);
                            if (config.property) {
                                payload = oe.getProp(parsed, config.property);
                            } else {
                                payload = parsed;
                            }
                        } catch (err) {}
                    }
                    let msg = {topic, payload, qos: packet.qos, retain: packet.retain};
                    if (parsed) {
                        delete parsed.topic;
                        delete parsed.payload;
                        delete parsed._msgid;

                        msg = Object.assign(msg, parsed);
                    }
                    if ((node.brokerConn.broker === 'localhost') || (node.brokerConn.broker === '127.0.0.1')) {
                        msg._topic = topic;
                    }
                    node.send(msg);
                }, this.id);
                if (this.brokerConn.connected) {
                    node.status({fill: 'green', shape: 'dot', text: 'node-red:common.status.connected'});
                }
            } else {
                this.error(RED._('mqtt.errors.not-defined'));
            }
            this.on('close', done => {
                if (node.brokerConn) {
                    node.brokerConn.unsubscribe(node.topic, node.id);
                    node.brokerConn.deregister(node, done);
                }
            });
        } else {
            this.error(RED._('mqtt.errors.missing-config'));
        }
    }
    RED.nodes.registerType('mqtt-json', MQTTJSONInNode);
};
