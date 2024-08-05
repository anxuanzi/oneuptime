import SpanUtil, { DivisibilityFactor } from "../../Utils/SpanUtil";
import TelemetryServiceElement from "../TelemetryService/TelemetryServiceElement";
import SpanStatusElement from "./SpanStatusElement";
import SortOrder from "Common/Types/BaseDatabase/SortOrder";
import CodeType from "Common/Types/Code/CodeType";
import { LIMIT_PER_PROJECT } from "Common/Types/Database/LimitMax";
import { PromiseVoidFunction } from "Common/Types/FunctionTypes";
import JSONFunctions from "Common/Types/JSONFunctions";
import Accordion from "CommonUI/src/Components/Accordion/Accordion";
import AccordionGroup from "CommonUI/src/Components/Accordion/AccordionGroup";
import CodeEditor from "CommonUI/src/Components/CodeEditor/CodeEditor";
import Detail from "CommonUI/src/Components/Detail/Detail";
import ErrorMessage from "CommonUI/src/Components/ErrorMessage/ErrorMessage";
import PageLoader from "CommonUI/src/Components/Loader/PageLoader";
import LogsViewer from "CommonUI/src/Components/LogsViewer/LogsViewer";
import { TabType } from "CommonUI/src/Components/Tabs/Tab";
import Tabs from "CommonUI/src/Components/Tabs/Tabs";
import FieldType from "CommonUI/src/Components/Types/FieldType";
import { GetReactElementFunction } from "CommonUI/src/Types/FunctionTypes";
import API from "CommonUI/src/Utils/API/API";
import AnalyticsModelAPI, {
  ListResult,
} from "CommonUI/src/Utils/AnalyticsModelAPI/AnalyticsModelAPI";
import Select from "CommonUI/src/Utils/BaseDatabase/Select";
import ProjectUtil from "CommonUI/src/Utils/Project";
import Log from "Common/AppModels/AnalyticsModels/Log";
import Span, {
  SpanEvent,
  SpanEventType,
} from "Common/AppModels/AnalyticsModels/Span";
import TelemetryService from "Common/Models/DatabaseModels/TelemetryService";
import React, { FunctionComponent, ReactElement, useEffect } from "react";

export interface ComponentProps {
  id: string;
  openTelemetrySpanId: string;
  traceStartTimeInUnixNano: number;
  onClose: () => void;
  telemetryService: TelemetryService;
  divisibilityFactor: DivisibilityFactor;
}

const SpanViewer: FunctionComponent<ComponentProps> = (
  props: ComponentProps,
): ReactElement => {
  const [logs, setLogs] = React.useState<Array<Log>>([]);
  const [error, setError] = React.useState<string>("");
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [span, setSpan] = React.useState<Span | null>(null);

  const { telemetryService, onClose } = props;

  const selectLog: Select<Log> = {
    body: true,
    time: true,
    projectId: true,
    serviceId: true,
    spanId: true,
    traceId: true,
    severityText: true,
    attributes: true,
  };

  const selectSpan: Select<Span> = {
    projectId: true,
    serviceId: true,
    spanId: true,
    traceId: true,
    events: true,
    startTime: true,
    endTime: true,
    startTimeUnixNano: true,
    endTimeUnixNano: true,
    attributes: true,
    durationUnixNano: true,
    name: true,
  };

  useEffect(() => {
    fetchItems().catch((err: Error) => {
      setError(API.getFriendlyMessage(err));
    });
  }, []);

  const fetchItems: PromiseVoidFunction = async (): Promise<void> => {
    setError("");
    setIsLoading(true);

    try {
      const listResult: ListResult<Log> = await AnalyticsModelAPI.getList<Log>({
        modelType: Log,
        query: {
          spanId: props.openTelemetrySpanId,
          projectId: ProjectUtil.getCurrentProjectId()!,
        },
        limit: LIMIT_PER_PROJECT,
        skip: 0,
        select: selectLog,
        sort: {
          time: SortOrder.Descending,
        },
        requestOptions: {},
      });

      // reverse the logs so that the newest logs are at the bottom
      listResult.data.reverse();

      setLogs(listResult.data);

      const spanResult: ListResult<Span> =
        await AnalyticsModelAPI.getList<Span>({
          modelType: Span,
          query: {
            spanId: props.openTelemetrySpanId,
            projectId: ProjectUtil.getCurrentProjectId()!,
          },
          select: selectSpan,
          limit: 1,
          skip: 0,
          sort: {},
          requestOptions: {},
        });

      if (spanResult.data.length > 0) {
        setSpan(spanResult.data[0] || null);
      }
    } catch (err) {
      setError(API.getFriendlyMessage(err));
    }

    setIsLoading(false);
  };

  if (error) {
    return <ErrorMessage error={error} />;
  }

  if (isLoading) {
    return <PageLoader isVisible={true} />;
  }

  const getLogsContentElement: GetReactElementFunction = (): ReactElement => {
    return (
      <LogsViewer
        isLoading={isLoading}
        onFilterChanged={() => {}}
        filterData={{}}
        logs={logs}
        showFilters={false}
        noLogsMessage={"No logs found for this span."}
      />
    );
  };

  const getAttributesContentElement: GetReactElementFunction =
    (): ReactElement => {
      if (!span) {
        return <ErrorMessage error="Span not found" />;
      }

      return (
        <Detail<Span>
          item={span}
          fields={[
            {
              key: "attributes",
              title: "Span Attributes",
              description: "The attributes of the span.",
              fieldType: FieldType.Element,
              getElement: (span: Span) => {
                return (
                  <CodeEditor
                    type={CodeType.JSON}
                    initialValue={JSONFunctions.toFormattedString(
                      JSONFunctions.nestJson(span.attributes || {}),
                    )}
                    readOnly={true}
                  />
                );
              },
            },
          ]}
        />
      );
    };

  type GetEvebtContentElementFunction = (event: SpanEvent) => ReactElement;

  const getEventContentElement: GetEvebtContentElementFunction = (
    event: SpanEvent,
  ): ReactElement => {
    if (!span) {
      return <ErrorMessage error="No span found" />;
    }

    if (!event) {
      return <ErrorMessage error="No event found" />;
    }

    return (
      <Detail<SpanEvent>
        item={event}
        fields={[
          {
            key: "name",
            title: "Event Name",
            description: "The name of the event.",
          },
          {
            key: "timeUnixNano",
            title: "Time in Trace",
            description: "The time the event occurred in the trace.",
            fieldType: FieldType.Element,
            getElement: (event: SpanEvent) => {
              return (
                <div>
                  {SpanUtil.getSpanEventTimeAsString({
                    timelineStartTimeUnixNano: props.traceStartTimeInUnixNano,
                    divisibilityFactor: props.divisibilityFactor,
                    spanEventTimeUnixNano: event.timeUnixNano!,
                  })}
                </div>
              );
            },
          },
          {
            key: "timeUnixNano",
            title: "Time in Span",
            description: "The time the event occurred in this span",
            fieldType: FieldType.Element,
            getElement: (event: SpanEvent) => {
              return (
                <div>
                  {SpanUtil.getSpanEventTimeAsString({
                    timelineStartTimeUnixNano: span!.startTimeUnixNano!,
                    divisibilityFactor: props.divisibilityFactor,
                    spanEventTimeUnixNano: event!.timeUnixNano!,
                  })}
                </div>
              );
            },
          },
          {
            key: "time",
            title: "Seen At",
            description: "The time the event occurred.",
            fieldType: FieldType.DateTime,
          },
          {
            key: "attributes",
            title: "Event Attributes",
            description: "The attributes of the event.",
            fieldType: FieldType.Element,
            getElement: (event: SpanEvent) => {
              return (
                <CodeEditor
                  type={CodeType.JSON}
                  initialValue={JSONFunctions.toFormattedString(
                    JSONFunctions.nestJson(event.attributes || {}),
                  )}
                  readOnly={true}
                />
              );
            },
          },
        ]}
      />
    );
  };

  const getEventsContentElement: GetReactElementFunction = (): ReactElement => {
    return getEvents(SpanEventType.Event);
  };

  type GetEventsFunction = (eventType: SpanEventType) => ReactElement;
  const getEvents: GetEventsFunction = (
    eventType: SpanEventType,
  ): ReactElement => {
    const eventsToShow: SpanEvent[] | undefined = span?.events?.filter(
      (event: SpanEvent) => {
        if (eventType === SpanEventType.Exception) {
          // name of the event is exception
          return event.name === SpanEventType.Exception.toLowerCase();
        }
        return event.name !== SpanEventType.Exception.toLowerCase();
      },
    );

    if (!eventsToShow || eventsToShow.length === 0) {
      if (eventType === SpanEventType.Exception) {
        return <ErrorMessage error="No exceptions found for this span." />;
      }
      return <ErrorMessage error="No events found for this span." />;
    }

    let bgColorClassName: string = "bg-indigo-500";

    if (eventType === SpanEventType.Exception) {
      bgColorClassName = "bg-red-500";
    }

    return (
      <AccordionGroup>
        {eventsToShow.map((event: SpanEvent, index: number) => {
          return (
            <Accordion
              titleClassName="text-sm"
              title={
                <div className="flex space-x-2">
                  <div className="flex space-x-2">
                    <div
                      className={`rounded-md text-white p-1 text-xs font-semibold ${bgColorClassName}`}
                    >
                      {eventType}: {index + 1}
                    </div>
                    <div className="flex space-x-1">
                      <div className="mt-0.5 font-medium">{event.name}</div>
                      <div className="text-gray-500 mt-0.5">
                        {" "}
                        at{" "}
                        {SpanUtil.getSpanEventTimeAsString({
                          timelineStartTimeUnixNano:
                            props.traceStartTimeInUnixNano,
                          divisibilityFactor: props.divisibilityFactor,
                          spanEventTimeUnixNano: event.timeUnixNano!,
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              }
              key={index}
            >
              {getEventContentElement(event)}
            </Accordion>
          );
        })}
      </AccordionGroup>
    );
  };

  const getExceptionsContentElement: GetReactElementFunction =
    (): ReactElement => {
      return getEvents(SpanEventType.Exception);
    };

  const getBasicInfo: GetReactElementFunction = (): ReactElement => {
    if (!span) {
      return <ErrorMessage error="Span not found" />;
    }

    return (
      <Detail<Span>
        item={span}
        fields={[
          {
            key: "spanId",
            title: "Span ID",
            description: "The unique identifier of the span.",
            fieldType: FieldType.Text,
            opts: {
              isCopyable: true,
            },
          },
          {
            key: "name",
            title: "Span Name",
            description: "The name of the span.",
            fieldType: FieldType.Text,
          },
          {
            key: "statusCode",
            title: "Span Status",
            description: "The status of the span.",
            fieldType: FieldType.Element,
            getElement: (span: Span) => {
              return (
                <div>
                  <SpanStatusElement
                    traceId={span.traceId?.toString()}
                    spanStatusCode={span.statusCode!}
                    title={
                      "Status: " +
                      SpanUtil.getSpanStatusCodeFriendlyName(span.statusCode!)
                    }
                  />{" "}
                </div>
              );
            },
          },
          {
            key: "traceId",
            title: "Trace ID",
            description: "The unique identifier of the trace.",
            fieldType: FieldType.Text,
            opts: {
              isCopyable: true,
            },
          },
          {
            key: "serviceId",
            title: "Telemetry Service",
            description: "The unique identifier of the service.",
            fieldType: FieldType.Element,
            getElement: () => {
              return (
                <TelemetryServiceElement
                  telemetryService={telemetryService}
                  onNavigateComplete={() => {
                    onClose();
                  }}
                />
              );
            },
          },
          {
            key: "startTime",
            title: "Start Time",
            description: "The time the span started.",
            fieldType: FieldType.DateTime,
          },
          {
            key: "endTime",
            title: "End Time",
            description: "The time the span ended.",
            fieldType: FieldType.DateTime,
          },
          {
            key: "startTimeUnixNano",
            title: "Starts At",
            description: "When did this span start in this trace?",
            fieldType: FieldType.Element,
            getElement: (span: Span) => {
              return (
                <div>
                  {SpanUtil.getSpanStartsAtAsString({
                    timelineStartTimeUnixNano: props.traceStartTimeInUnixNano,
                    divisibilityFactor: props.divisibilityFactor,
                    spanStartTimeUnixNano: span.startTimeUnixNano!,
                  })}
                </div>
              );
            },
          },
          {
            key: "endTimeUnixNano",
            title: "Ends At",
            description: "When did this span end in this trace?",
            fieldType: FieldType.Element,
            getElement: (span: Span) => {
              return (
                <div>
                  {SpanUtil.getSpanEndsAtAsString({
                    timelineStartTimeUnixNano: props.traceStartTimeInUnixNano,
                    divisibilityFactor: props.divisibilityFactor,
                    spanEndTimeUnixNano: span.endTimeUnixNano!,
                  })}
                </div>
              );
            },
          },
          {
            key: "durationUnixNano",
            title: "Duration",
            description: "The duration of the span.",
            fieldType: FieldType.Element,
            getElement: (span: Span) => {
              return (
                <div>
                  {SpanUtil.getSpanDurationAsString({
                    divisibilityFactor: props.divisibilityFactor,
                    spanDurationInUnixNano: span.durationUnixNano!,
                  })}
                </div>
              );
            },
          },
          {
            key: "kind",
            title: "Span Kind",
            description: "The kind of span.",
            fieldType: FieldType.Element,
            getElement: (span: Span) => {
              return <div>{SpanUtil.getSpanKindFriendlyName(span.kind!)}</div>;
            },
          },
        ]}
      />
    );
  };

  return (
    <div id={props.id}>
      <Tabs
        tabs={[
          {
            name: "Basic Info",
            children: getBasicInfo(),
          },
          {
            name: "Logs",
            children: getLogsContentElement(),
            countBadge: logs.length,
            tabType: TabType.Info,
          },
          {
            name: "Attributes",
            children: getAttributesContentElement(),
          },
          {
            name: "Events",
            children: getEventsContentElement(),
            countBadge: span?.events?.filter((event: SpanEvent) => {
              return event.name !== SpanEventType.Exception.toLowerCase();
            }).length,
            tabType: TabType.Info,
          },
          {
            name: "Exceptions",
            children: getExceptionsContentElement(),
            tabType: TabType.Error,
            countBadge: span?.events?.filter((event: SpanEvent) => {
              return event.name === SpanEventType.Exception.toLowerCase();
            }).length,
          },
        ]}
        onTabChange={() => {}}
      />

      {span && <></>}
    </div>
  );
};

export default SpanViewer;
