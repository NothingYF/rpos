///<reference path="../typings/main.d.ts" />
///<reference path="../rpos.d.ts" />

import fs = require("fs");
import util = require("util");
import os = require('os');
import SoapService = require('../lib/SoapService');
import { Utils }  from '../lib/utils';
import { Server } from 'http';
import configs = require('./ptz_base');

var utils = Utils.utils;

class PTZService extends SoapService {
  ptz_service: any;
  callback: any;
  configs: any;

  presetArray = [];

  constructor(config: rposConfig, server: Server, callback, ptzBase) {
    super(config, server);

    this.ptz_service = require('./stubs/ptz_service.js').PTZService;
    this.callback = callback;

    this.configs = ptzBase

    this.serviceOptions = {
      path: '/onvif/ptz_service',
      services: this.ptz_service,
      xml: fs.readFileSync('./wsdl/ptz_service.wsdl', 'utf8'),
      wsdlPath: 'wsdl/ptz_service.wsdl',
      onReady: () => console.log('ptz_service started')
    };

    for (var i = 1; i <= 255; i++) {
      this.presetArray.push({ profileToken: 'token', presetName: '', presetToken: i.toString(), used: false });
    }

    this.extendService();
  }

  extendService() {
    var port = this.ptz_service.PTZService.PTZ;


    // var config = json.ptzconfig;
    var node = this.configs.node;
    var config = this.configs.ptzconfig;
    var configOption = this.configs.ptzconfigOption;

    port.GetNode = (args) => {
      if (args.NodeToken == node.attributes.token) {
        var GetNodeResponse = { PTZNode: node };
        return GetNodeResponse;
      } else {
        var NOT_IMPLEMENTED = {
          Fault: {
            Code: {
              Value: "soap:Sender",
              Subcode: {
                Value: "ter:InvalidArgVal",
                Subcode: {
                  Value: "ter:NoEntity",
                }
              }
            },
            Reason: {
              Text: "Invalid Token"
            }
          }
        };
        throw NOT_IMPLEMENTED;
      }
    };

    port.GetNodes = (args) => {
      var GetNodesResponse = { PTZNode: node };
      return GetNodesResponse;
    };

    port.GetConfigurations = (args) => {
      var GetConfigurationsResponse = { PTZConfiguration: config };
      return GetConfigurationsResponse;
    };

    port.GetConfiguration = (args) => {
      var GetConfigurationResponse = { PTZConfiguration: config };
      return GetConfigurationResponse;
    };

    port.GetConfigurationOptions = (args) => {
      if (args.ConfigurationToken == config.attributes.token) {
        var GetConfigurationOptionsResponse = { PTZConfigurationOptions: configOption };
        return GetConfigurationOptionsResponse;
      } else {
        var NOT_IMPLEMENTED = {
          Fault: {
            Code: {
              Value: "soap:Sender",
              Subcode: {
                Value: "ter:InvalidArgVal",
                Subcode: {
                  Value: "ter:NoEntity",
                }
              }
            },
            Reason: {
              Text: "Invalid Token"
            }
          }
        };
        throw NOT_IMPLEMENTED;
      }
    };


    port.SetHomePosition = (args) => {
      if (this.callback) this.callback('sethome', {});
      var SetHomePositionResponse = {};
      return SetHomePositionResponse;
    };

    port.GotoHomePosition = (args) => {
      if (this.callback) this.callback('gotohome', {});
      var GotoHomePositionResponse = {};
      return GotoHomePositionResponse;
    };

    var pan = 0;
    var tilt = 0;
    var zoom = 0;
    var timeout = '';

    port.ContinuousMove = (args) => {
      // Update values or keep last known value
      try { pan = args.Velocity.PanTilt.attributes.x } catch (err) { };
      try { tilt = args.Velocity.PanTilt.attributes.y } catch (err) { };
      try { zoom = args.Velocity.Zoom.attributes.x } catch (err) { };
      try { timeout = args.Timeout } catch (err) { };
      if (this.callback) this.callback('ptz', { pan: pan, tilt: tilt, zoom: zoom });
      var ContinuousMoveResponse = {};
      return ContinuousMoveResponse;
    };


    port.Stop = (args) => {
      // Update values (to zero) or keep last known value
      var pan_tilt_stop = false;
      var zoom_stop = false;
      try { pan_tilt_stop = args.PanTilt } catch (err) { };
      try { zoom_stop = args.Zoom } catch (err) { };
      if (pan_tilt_stop) {
        pan = 0;
        tilt = 0;
      }
      if (zoom_stop) {
        zoom = 0;
      }
      if (this.callback) this.callback('ptz', { pan: pan, tilt: tilt, zoom: zoom });
      var StopResponse = {};
      return StopResponse;
    };



    port.GetPresets = (args) => {
      var GetPresetsResponse = { Preset: [] };
      var matching_profileToken = args.ProfileToken;

      for (var i = 0; i < this.presetArray.length; i++) {
        if (this.presetArray[i].profileToken === matching_profileToken
          && this.presetArray[i].used == true) {
          var p = {
            attributes: {
              token: this.presetArray[i].presetToken
            },
            Name: this.presetArray[i].presetName
          };
          GetPresetsResponse.Preset.push(p);
        }
      }
      return GetPresetsResponse;
    };


    port.GotoPreset = (args) => {
      var GotoPresetResponse = {};
      var matching_profileToken = args.ProfileToken;
      var matching_presetToken = args.PresetToken;

      for (var i = 0; i < this.presetArray.length; i++) {
        if (matching_profileToken === this.presetArray[i].profileToken
          && matching_presetToken === this.presetArray[i].presetToken
          && this.presetArray[i].used == true) {
          if (this.callback) this.callback('gotopreset', {
            name: this.presetArray[i].presetName,
            value: this.presetArray[i].presetToken
          });
          break;
        }
      }
      return GotoPresetResponse;
    };

    port.RemovePreset = (args) => {
      var RemovePresetResponse = {};

      var matching_profileToken = args.ProfileToken;
      var matching_presetToken = args.PresetToken;

      for (var i = 0; i < this.presetArray.length; i++) {
        if (matching_profileToken === this.presetArray[i].profileToken
          && matching_presetToken === this.presetArray[i].presetToken) {
          this.presetArray[i].used = false;
          if (this.callback) this.callback('clearpreset', {
            name: this.presetArray[i].presetName,
            value: this.presetArray[i].presetToken
          });
          break;
        }
      }

      return RemovePresetResponse;
    };

    port.SetPreset = (args) => {

      var SetPresetResponse;

      var profileToken = args.ProfileToken;
      var presetName = args.PresetName;   // used when creating a preset 
      var presetToken = args.PresetToken; // used when updating an existing preset


      if (presetToken) {
        for (var i = 0; i < this.presetArray.length; i++) {
          if (profileToken === this.presetArray[i]
            && presetToken === this.presetArray[i]) {
            this.presetArray[i].presetName = presetName;
            this.presetArray[i].used = true;
            if (this.callback) this.callback('setpreset', {
              name: presetName,
              value: presetToken
            });
            break;
          }
          SetPresetResponse = { PresetToken: presetToken };

          return SetPresetResponse;
        }
      } else {
        // Check if the preset name is a number (special case)
        var special_case_name = false;
        try {
          var preset_name_value = parseInt(presetName);
          if (preset_name_value > 0 && preset_name_value < 255) {
            special_case_name = true;
          }
        } catch (err) {
        }
        if (special_case_name) {
          if (this.callback) this.callback('setpreset', {
            name: presetName,
            value: presetName
          });
          SetPresetResponse = { PresetToken: presetName };
          return SetPresetResponse;
        } else {
          // Find the first unused token and use it
          var new_presetToken = '';
          for (var i = 0; i < this.presetArray.length; i++) {
            if (profileToken === this.presetArray[i].profileToken
              && this.presetArray[i].used == false) {
              this.presetArray[i].presetName = presetName;
              this.presetArray[i].used = true;
              new_presetToken = this.presetArray[i].presetToken;
              if (this.callback) this.callback('setpreset', {
                name: presetName,
                value: new_presetToken
              });
              break;
            }
          }
          SetPresetResponse = { PresetToken: new_presetToken };
          return SetPresetResponse;
        }
      }
    };

    port.SetConfiguration = args => {
      if (args.PTZConfiguration.attributes.token === config.attributes.token) {
        var SetConfigurationResponse = {};
        config.DefaultPTZTimeout = args.PTZConfiguration.DefaultPTZTimeout;
        return SetConfigurationResponse;
      } else {
        var NOT_IMPLEMENTED = {
          Fault: {
            Code: {
              Value: "soap:Sender",
              Subcode: {
                Value: "ter:InvalidArgVal",
                Subcode: {
                  Value: "ter:NoEntity",
                }
              }
            },
            Reason: {
              Text: "Invalid Token"
            }
          }
        };
        throw NOT_IMPLEMENTED;
      }
    };

    port.SendAuxiliaryCommand = args => {
      console.log(node.attributes.token, args.ProfileToken);
      if (args.ProfileToken === node.attributes.token) {
        var SendAuxiliaryCommandResponse = {
          attributes: {
            AuxiliaryResponse: "Done"
          }
        };
        return SendAuxiliaryCommandResponse;
      } else {
        var FAULT = {
          Fault: {
            Code: {
              Value: "soap:Sender",
              Subcode: {
                Value: "ter:InvalidArgVal",
                Subcode: {
                  Value: "ter:NoProfile",
                }
              }
            },
            Reason: {
              Text: "Invalid Token"
            }
          }
        };
        throw FAULT;
      }
    };

    port.GetStatus = args => {
      console.log("args are", args);
      return this.configs.ptzstatus;
    };

  }
}
export = PTZService;
