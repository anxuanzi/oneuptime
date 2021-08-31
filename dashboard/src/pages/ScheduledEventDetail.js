import React, { Component } from 'react';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import Fade from 'react-reveal/Fade';
import BreadCrumbItem from '../components/breadCrumb/BreadCrumbItem';
import {
    fetchscheduledEvent,
    fetchScheduledEventNotesInternal,
    updateScheduledEventNoteInvestigationSuccess,
    updateScheduledEventNoteInternalSuccess,
    deleteScheduledEventNoteSuccess,
    createScheduledEventNoteSuccess,
    fetchScheduledEvent,
} from '../actions/scheduledEvent';
import getParentRoute from '../utils/getParentRoute';
import { LoadingState } from '../components/basic/Loader';
import ShouldRender from '../components/basic/ShouldRender';
import ScheduledEventDescription from '../components/scheduledEvent/ScheduledEventDescription';
import ScheduledEventNote from '../components/scheduledEvent/ScheduledEventNote';
import { REALTIME_URL } from '../config';
import io from 'socket.io-client';
import { Tab, Tabs, TabList, TabPanel, resetIdCounter } from 'react-tabs';
import ScheduleEventDeleteBox from '../components/scheduledEvent/ScheduleEventDeleteBox';

// Important: Below `/realtime` is also needed because `io` constructor strips out the path from the url.
// '/realtime' is set as socket io namespace, so remove
const socket = io.connect(REALTIME_URL.replace('/realtime', ''), {
    path: '/realtime/socket.io',
    transports: ['websocket', 'polling'],
});

class ScheduledEvent extends Component {
    constructor(props) {
        super(props);
        this.limit = 10;
    }
    componentWillMount() {
        resetIdCounter();
    }
    tabSelected = index => {
        const tabSlider = document.getElementById('tab-slider');
        tabSlider.style.transform = `translate(calc(${tabSlider.offsetWidth}px*${index}), 0px)`;
    };

    componentDidMount() {
        this.ready();
    }

    componentDidUpdate(prevProps) {
        if (
            String(prevProps.scheduledEventId) !==
            String(this.props.scheduledEventId)
        ) {
            const {
                fetchScheduledEventNotesInternal,
                updateScheduledEventNoteInvestigationSuccess,
                updateScheduledEventNoteInternalSuccess,
                deleteScheduledEventNoteSuccess,
                createScheduledEventNoteSuccess,
                scheduledEventId,
            } = this.props;
            // fetch scheduled event notes
            if (scheduledEventId) {
                fetchScheduledEventNotesInternal(
                    this.props.projectId,
                    scheduledEventId,
                    this.limit,
                    0
                );
            }
            socket.on(
                `addScheduledEventInternalNote-${scheduledEventId}`,
                event => createScheduledEventNoteSuccess(event)
            );
            socket.on(
                `addScheduledEventInvestigationNote-${scheduledEventId}`,
                event => createScheduledEventNoteSuccess(event)
            );
            socket.on(
                `updateScheduledEventInternalNote-${scheduledEventId}`,
                event => updateScheduledEventNoteInternalSuccess(event)
            );
            socket.on(
                `updateScheduledEventInvestigationNote-${scheduledEventId}`,
                event => updateScheduledEventNoteInvestigationSuccess(event)
            );
            socket.on(
                `deleteScheduledEventInternalNote-${scheduledEventId}`,
                event => deleteScheduledEventNoteSuccess(event)
            );
            socket.on(
                `deleteScheduledEventInvestigationNote-${scheduledEventId}`,
                event => deleteScheduledEventNoteSuccess(event)
            );
        }
    }
    ready = () => {
        resetIdCounter();
        if (this.props.scheduledEventSlug) {
            const { fetchScheduledEvent } = this.props;

            //fetch scheduledEvent with slug
            fetchScheduledEvent(
                this.props.projectId,
                this.props.scheduledEventSlug
            );
        }
        if (this.props.scheduledEventId) {
            fetchScheduledEventNotesInternal(
                this.props.projectId,
                this.props.scheduledEventId,
                this.limit,
                0
            );
        }
    };

    render() {
        const {
            location: { pathname },
            requesting,
            scheduledEvent,
            scheduledEventId,
            internalNotesList,
            monitorList,
            currentProject,
            switchToProjectViewerNav,
        } = this.props;
        const eventName = scheduledEvent ? scheduledEvent.name : '';
        const projectName = currentProject ? currentProject.name : '';
        const projectId = currentProject ? currentProject._id : '';
        return (
            <Fade>
                <BreadCrumbItem
                    route="/"
                    name={projectName}
                    projectId={projectId}
                    slug={currentProject ? currentProject.slug : null}
                    switchToProjectViewerNav={switchToProjectViewerNav}
                />
                <BreadCrumbItem
                    route={getParentRoute(pathname)}
                    name="Scheduled Maintenance Event"
                />
                <BreadCrumbItem
                    route={pathname}
                    name={eventName}
                    pageTitle="Scheduled Event Detail"
                    containerType="Scheduled Maintenance Event"
                />
                <ShouldRender if={requesting}>
                    <LoadingState />
                </ShouldRender>
                <ShouldRender if={!requesting}>
                    <Tabs
                        selectedTabClassName={'custom-tab-selected'}
                        onSelect={tabIndex => this.tabSelected(tabIndex)}
                    >
                        <div className="Flex-flex Flex-direction--columnReverse">
                            <TabList
                                id="customTabList"
                                className={'custom-tab-list'}
                            >
                                <Tab
                                    className={
                                        'custom-tab custom-tab-3 basic-tab'
                                    }
                                >
                                    Basic
                                </Tab>
                                <Tab
                                    className={
                                        'custom-tab custom-tab-3 timeline-tab'
                                    }
                                >
                                    Timeline
                                </Tab>
                                <Tab
                                    className={
                                        'custom-tab custom-tab-3 advanced-options-tab'
                                    }
                                >
                                    Advanced Options
                                </Tab>
                                <div
                                    id="tab-slider"
                                    className="custom-tab-3"
                                ></div>
                            </TabList>
                        </div>
                        <TabPanel>
                            <Fade>
                                <ShouldRender if={scheduledEvent}>
                                    <div>
                                        <div>
                                            <div className="db-BackboneViewContainer">
                                                <div className="react-settings-view react-view">
                                                    <span>
                                                        <div>
                                                            <ScheduledEventDescription
                                                                scheduledEvent={
                                                                    scheduledEvent
                                                                }
                                                                monitorList={
                                                                    monitorList
                                                                }
                                                            />
                                                        </div>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </ShouldRender>
                            </Fade>
                        </TabPanel>
                        <TabPanel>
                            <Fade>
                                <ShouldRender if={internalNotesList.requesting}>
                                    <LoadingState />
                                </ShouldRender>
                                <ShouldRender
                                    if={!internalNotesList.requesting}
                                >
                                    <div>
                                        <div>
                                            <div className="db-BackboneViewContainer">
                                                <div className="react-settings-view react-view">
                                                    <div className="Box-root Margin-bottom--12">
                                                        <div className="bs-ContentSection Card-root Card-shadow--medium">
                                                            <ScheduledEventNote
                                                                type="Internal"
                                                                notes={
                                                                    internalNotesList.scheduledEventNotes
                                                                }
                                                                count={
                                                                    internalNotesList.count
                                                                }
                                                                projectId={
                                                                    this.props
                                                                        .projectId
                                                                }
                                                                scheduledEventId={
                                                                    scheduledEventId
                                                                }
                                                                scheduledEvent={
                                                                    scheduledEvent
                                                                }
                                                                skip={
                                                                    internalNotesList.skip
                                                                }
                                                                limit={
                                                                    internalNotesList.limit
                                                                }
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </ShouldRender>
                            </Fade>
                        </TabPanel>
                        <TabPanel>
                            <Fade>
                                <ShouldRender if={scheduledEvent}>
                                    <ScheduleEventDeleteBox
                                        projectId={this.props.projectId}
                                        scheduledEventId={scheduledEventId}
                                        scheduledEvent={scheduledEvent}
                                    />
                                </ShouldRender>
                            </Fade>
                        </TabPanel>
                    </Tabs>
                </ShouldRender>
            </Fade>
        );
    }
}

ScheduledEvent.displayName = 'ScheduledEvent';

ScheduledEvent.propTypes = {
    location: PropTypes.shape({
        pathname: PropTypes.string,
    }),
    scheduledEventId: PropTypes.string,
    fetchScheduledEvent: PropTypes.func,
    projectId: PropTypes.string,
    scheduledEventSlug: PropTypes.string,
    scheduledEvent: PropTypes.object,
    requesting: PropTypes.bool,
    fetchScheduledEventNotesInternal: PropTypes.func,
    internalNotesList: PropTypes.object,
    updateScheduledEventNoteInvestigationSuccess: PropTypes.func,
    updateScheduledEventNoteInternalSuccess: PropTypes.func,
    deleteScheduledEventNoteSuccess: PropTypes.func,
    createScheduledEventNoteSuccess: PropTypes.func,
    monitorList: PropTypes.array,
    currentProject: PropTypes.object.isRequired,
    switchToProjectViewerNav: PropTypes.bool,
};

const mapStateToProps = (state, props) => {
    const { scheduledEventSlug } = props.match.params;
    const monitorList = [];
    state.monitor.monitorsList.monitors.map(data => {
        data.monitors.map(monitor => {
            monitorList.push(monitor);
            return monitor;
        });
        return data;
    });

    return {
        scheduledEvent:
            state.scheduledEvent.currentScheduledEvent &&
            state.scheduledEvent.currentScheduledEvent.scheduledEvent,
        requesting: state.scheduledEvent.newScheduledEvent.requesting,
        internalNotesList: state.scheduledEvent.scheduledEventInternalList,
        investigationNotesList:
            state.scheduledEvent.scheduledEventInvestigationList,
        monitorList,
        scheduledEventSlug,
        projectId:
            state.project.currentProject && state.project.currentProject._id,
        scheduledEventId:
            state.scheduledEvent.currentScheduledEvent.scheduledEvent &&
            state.scheduledEvent.currentScheduledEvent.scheduledEvent._id,
        currentProject: state.project.currentProject,
        switchToProjectViewerNav: state.project.switchToProjectViewerNav,
    };
};

const mapDispatchToProps = dispatch =>
    bindActionCreators(
        {
            fetchscheduledEvent,
            fetchScheduledEventNotesInternal,
            updateScheduledEventNoteInvestigationSuccess,
            updateScheduledEventNoteInternalSuccess,
            deleteScheduledEventNoteSuccess,
            createScheduledEventNoteSuccess,
            fetchScheduledEvent,
        },
        dispatch
    );

export default connect(mapStateToProps, mapDispatchToProps)(ScheduledEvent);
