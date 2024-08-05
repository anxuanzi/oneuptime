import Dictionary from "../Dictionary";
import { JSONObject } from "../JSON";
import LogSeverity from "../Log/LogSeverity";
import ObjectID from "../ObjectID";

export default interface MonitorStepLogMonitor {
  attributes: Dictionary<string | number | boolean>;
  body: string;
  severityText: Array<LogSeverity>;
  telemetryServiceIds: Array<ObjectID>;
  lastXSecondsOfLogs: number;
}

export class MonitorStepLogMonitorUtil {
  public static getDefault(): MonitorStepLogMonitor {
    return {
      attributes: {},
      body: "",
      severityText: [],
      telemetryServiceIds: [],
      lastXSecondsOfLogs: 60,
    };
  }

  public static fromJSON(json: JSONObject): MonitorStepLogMonitor {
    return {
      attributes:
        (json["attributes"] as Dictionary<string | number | boolean>) || {},
      body: json["body"] as string,
      severityText: json["severityText"] as Array<LogSeverity>,
      telemetryServiceIds: ObjectID.fromJSONArray(
        json["telemetryServiceIds"] as Array<JSONObject>,
      ),
      lastXSecondsOfLogs: json["lastXSecondsOfLogs"] as number,
    };
  }

  public static toJSON(monitor: MonitorStepLogMonitor): JSONObject {
    return {
      attributes: monitor.attributes,
      body: monitor.body,
      severityText: monitor.severityText,
      telemetryServiceId: ObjectID.toJSONArray(monitor.telemetryServiceIds),
      lastXSecondsOfLogs: monitor.lastXSecondsOfLogs,
    };
  }
}
