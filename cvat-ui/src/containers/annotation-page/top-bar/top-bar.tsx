// Copyright (C) 2020 Intel Corporation
//
// SPDX-License-Identifier: MIT

import React from 'react';
import copy from 'copy-to-clipboard';
import { connect } from 'react-redux';
import { withRouter } from 'react-router';
import { RouteComponentProps } from 'react-router-dom';
import { GlobalHotKeys, ExtendedKeyMapOptions } from 'react-hotkeys';
import InputNumber from 'antd/lib/input-number';
import { SliderValue } from 'antd/lib/slider';

import {
    changeFrameAsync,
    switchPlay,
    saveAnnotationsAsync,
    collectStatisticsAsync,
    showStatistics as showStatisticsAction,
    undoActionAsync,
    redoActionAsync,
    searchAnnotationsAsync,
    searchEmptyFrameAsync,
    changeWorkspace as changeWorkspaceAction,
    activateObject,
} from 'actions/annotation-actions';
import { Canvas } from 'cvat-canvas-wrapper';

import AnnotationTopBarComponent from 'components/annotation-page/top-bar/top-bar';
import { CombinedState, FrameSpeed, Workspace } from 'reducers/interfaces';
import domtoimage from 'dom-to-image';
interface StateToProps {
    jobInstance: any;
    frameNumber: number;
    frameFilename: string;
    frameStep: number;
    frameSpeed: FrameSpeed;
    frameDelay: number;
    playing: boolean;
    saving: boolean;
    canvasIsReady: boolean;
    savingStatuses: string[];
    undoAction?: string;
    redoAction?: string;
    autoSave: boolean;
    autoSaveInterval: number;
    workspace: Workspace;
    keyMap: Record<string, ExtendedKeyMapOptions>;
    normalizedKeyMap: Record<string, string>;
    canvasInstance: Canvas;
}

interface DispatchToProps {
    onChangeFrame(frame: number, fillBuffer?: boolean, frameStep?: number): void;
    onSwitchPlay(playing: boolean): void;
    onSaveAnnotation(sessionInstance: any): void;
    showStatistics(sessionInstance: any): void;
    undo(sessionInstance: any, frameNumber: any): void;
    redo(sessionInstance: any, frameNumber: any): void;
    searchAnnotations(sessionInstance: any, frameFrom: number, frameTo: number): void;
    searchEmptyFrame(sessionInstance: any, frameFrom: number, frameTo: number): void;
    changeWorkspace(workspace: Workspace): void;
}

function mapStateToProps(state: CombinedState): StateToProps {
    const {
        annotation: {
            player: {
                playing,
                frame: { filename: frameFilename, number: frameNumber, delay: frameDelay },
            },
            annotations: {
                saving: { uploading: saving, statuses: savingStatuses },
                history,
            },
            job: { instance: jobInstance },
            canvas: { ready: canvasIsReady, instance: canvasInstance },
            workspace,
        },
        settings: {
            player: { frameSpeed, frameStep },
            workspace: { autoSave, autoSaveInterval },
        },
        shortcuts: { keyMap, normalizedKeyMap },
    } = state;

    return {
        frameStep,
        frameSpeed,
        frameDelay,
        playing,
        canvasIsReady,
        saving,
        savingStatuses,
        frameNumber,
        frameFilename,
        jobInstance,
        undoAction: history.undo.length ? history.undo[history.undo.length - 1][0] : undefined,
        redoAction: history.redo.length ? history.redo[history.redo.length - 1][0] : undefined,
        autoSave,
        autoSaveInterval,
        workspace,
        keyMap,
        normalizedKeyMap,
        canvasInstance,
    };
}

function mapDispatchToProps(dispatch: any): DispatchToProps {
    return {
        onChangeFrame(frame: number, fillBuffer?: boolean, frameStep?: number): void {
            dispatch(changeFrameAsync(frame, fillBuffer, frameStep));
        },
        onSwitchPlay(playing: boolean): void {
            dispatch(switchPlay(playing));
        },
        onSaveAnnotation(sessionInstance: any): void {
            dispatch(saveAnnotationsAsync(sessionInstance));
            // console.log(document.getElementById('cvat_canvas_background').getBoundingClientRect(),'poosit')
            const $theNodes = document.querySelector(".cvat-canvas-container");
            domtoimage.toPng($theNodes)
                .then(function (dataUrl) {
                    var img = new Image();
                    img.src = dataUrl;
                    // console.log(dataUrl,'dataUrl')
                    // document.body.appendChild(img);

                    // let style = window.getComputedStyle(document.getElementById('cvat_canvas_background'),null)
                    // let width = parseFloat(style.width)
                    // let height = parseFloat(style.height)
                    // let left = parseFloat(style.left)
                    // let top = parseFloat(style.top)-54

                    let style = document.getElementById('cvat_canvas_background').getBoundingClientRect()
                    let width = style.width
                    let height = style.height
                    let left = style.left
                    let top = style.top - 54

                    img.onload = function () {
                        var canvas = document.createElement('canvas');
                        var ctx = canvas.getContext('2d');
                        canvas.width = width;
                        canvas.height = height;
                        ctx.drawImage(img, left, top, width, height, 0, 0, width, height);

                        var dataImg = new Image()
                        let src = canvas.toDataURL('image/png')
                        dataImg.src = src
                        console.log(src, 'src')

                        document.body.appendChild(dataImg)
                    }






                });


        },
        showStatistics(sessionInstance: any): void {
            dispatch(collectStatisticsAsync(sessionInstance));
            dispatch(showStatisticsAction(true));
        },
        undo(sessionInstance: any, frameNumber: any): void {
            dispatch(undoActionAsync(sessionInstance, frameNumber));
        },
        redo(sessionInstance: any, frameNumber: any): void {
            dispatch(redoActionAsync(sessionInstance, frameNumber));
        },
        searchAnnotations(sessionInstance: any, frameFrom: number, frameTo: number): void {
            dispatch(searchAnnotationsAsync(sessionInstance, frameFrom, frameTo));
        },
        searchEmptyFrame(sessionInstance: any, frameFrom: number, frameTo: number): void {
            dispatch(searchEmptyFrameAsync(sessionInstance, frameFrom, frameTo));
        },
        changeWorkspace(workspace: Workspace): void {
            dispatch(activateObject(null, null));
            dispatch(changeWorkspaceAction(workspace));
        },
    };
}

interface State {
    prevButtonType: 'regular' | 'filtered' | 'empty';
    nextButtonType: 'regular' | 'filtered' | 'empty';
}

type Props = StateToProps & DispatchToProps & RouteComponentProps;
class AnnotationTopBarContainer extends React.PureComponent<Props, State> {
    private inputFrameRef: React.RefObject<InputNumber>;

    private autoSaveInterval: number | undefined;

    private unblock: any;

    constructor(props: Props) {
        super(props);
        this.inputFrameRef = React.createRef<InputNumber>();
        this.state = {
            prevButtonType: 'regular',
            nextButtonType: 'regular',
        };
    }

    public componentDidMount(): void {
        const { autoSaveInterval, history, jobInstance } = this.props;
        this.autoSaveInterval = window.setInterval(this.autoSave.bind(this), autoSaveInterval);

        this.unblock = history.block((location: any) => {
            const { task, id: jobID } = jobInstance;
            const { id: taskID } = task;

            if (jobInstance.annotations.hasUnsavedChanges() && location.pathname !== `/tasks/${taskID}/jobs/${jobID}`) {
                return 'You have unsaved changes, please confirm leaving this page.';
            }
            return undefined;
        });

        window.addEventListener('beforeunload', this.beforeUnloadCallback);
    }

    public componentDidUpdate(prevProps: Props): void {
        const {
            jobInstance,
            frameSpeed,
            frameNumber,
            frameDelay,
            playing,
            canvasIsReady,
            canvasInstance,
            onSwitchPlay,
            onChangeFrame,
            autoSaveInterval,
        } = this.props;

        if (autoSaveInterval !== prevProps.autoSaveInterval) {
            if (this.autoSaveInterval) window.clearInterval(this.autoSaveInterval);
            this.autoSaveInterval = window.setInterval(this.autoSave.bind(this), autoSaveInterval);
        }

        if (playing && canvasIsReady) {
            if (frameNumber < jobInstance.stopFrame) {
                let framesSkiped = 0;
                if (frameSpeed === FrameSpeed.Fast && frameNumber + 1 < jobInstance.stopFrame) {
                    framesSkiped = 1;
                }
                if (frameSpeed === FrameSpeed.Fastest && frameNumber + 2 < jobInstance.stopFrame) {
                    framesSkiped = 2;
                }

                setTimeout(() => {
                    const { playing: stillPlaying } = this.props;
                    if (stillPlaying) {
                        if (canvasInstance.isAbleToChangeFrame()) {
                            onChangeFrame(frameNumber + 1 + framesSkiped, stillPlaying, framesSkiped + 1);
                        } else {
                            onSwitchPlay(false);
                        }
                    }
                }, frameDelay);
            } else {
                onSwitchPlay(false);
            }
        }
    }

    public componentWillUnmount(): void {
        window.clearInterval(this.autoSaveInterval);
        window.removeEventListener('beforeunload', this.beforeUnloadCallback);
        this.unblock();
    }

    private undo = (): void => {
        const { undo, jobInstance, frameNumber, canvasInstance } = this.props;

        if (canvasInstance.isAbleToChangeFrame()) {
            undo(jobInstance, frameNumber);
        }
    };

    private redo = (): void => {
        const { redo, jobInstance, frameNumber, canvasInstance } = this.props;

        if (canvasInstance.isAbleToChangeFrame()) {
            redo(jobInstance, frameNumber);
        }
    };

    private showStatistics = (): void => {
        const { jobInstance, showStatistics } = this.props;

        showStatistics(jobInstance);
    };

    private onSwitchPlay = (): void => {
        const { frameNumber, jobInstance, onSwitchPlay, playing } = this.props;

        if (playing) {
            onSwitchPlay(false);
        } else if (frameNumber < jobInstance.stopFrame) {
            onSwitchPlay(true);
        }
    };

    private onFirstFrame = (): void => {
        const { frameNumber, jobInstance, playing, onSwitchPlay } = this.props;

        const newFrame = jobInstance.startFrame;
        if (newFrame !== frameNumber) {
            if (playing) {
                onSwitchPlay(false);
            }
            this.changeFrame(newFrame);
        }
    };
    private onSaveVideo = async (): Promise<void> => {
        const { jobInstance: { stopFrame } } = this.props;
        let countFrame = stopFrame;
        let bigImg: HTMLImageElement[] = [];
        this.onFirstFrame();
        const self = this;
        const $theNodes = document.querySelector(".cvat-canvas-container");
        let style = document.getElementById('cvat_canvas_background').getBoundingClientRect()
        let width = style.width
        let height = style.height
        let left = style.left
        let top = style.top - 54
        while (countFrame >= 0) {
            const dataBase64 = await domtoimage.toPng($theNodes);
            let img = new Image();
            img.src = dataBase64;
            var promise = new Promise((reslove) => {
                img.onload = async function () {
                    reslove();
                };
            })
            promise.then(() => {
                var canvas = document.createElement('canvas');
                var ctx = canvas.getContext('2d');
                canvas.width = width;
                canvas.height = height;
                ctx.drawImage(img, left, top, width, height, 0, 0, width, height);
                var dataImg = new Image();
                dataImg.src = canvas.toDataURL('image/png')
                bigImg.push(dataImg);
                self.onNextFrame();
                countFrame--;
            });
        }
        console.log(bigImg);
    };

    private onBackward = (): void => {
        const { frameNumber, frameStep, jobInstance, playing, onSwitchPlay } = this.props;

        const newFrame = Math.max(jobInstance.startFrame, frameNumber - frameStep);
        if (newFrame !== frameNumber) {
            if (playing) {
                onSwitchPlay(false);
            }
            this.changeFrame(newFrame);
        }
    };

    private onPrevFrame = (): void => {
        const { prevButtonType } = this.state;
        const { frameNumber, jobInstance, playing, onSwitchPlay, searchAnnotations, searchEmptyFrame } = this.props;
        const { startFrame } = jobInstance;

        const newFrame = Math.max(jobInstance.startFrame, frameNumber - 1);
        if (newFrame !== frameNumber) {
            if (playing) {
                onSwitchPlay(false);
            }
            if (prevButtonType === 'regular') {
                this.changeFrame(newFrame);
            } else if (prevButtonType === 'filtered') {
                searchAnnotations(jobInstance, frameNumber - 1, startFrame);
            } else {
                searchEmptyFrame(jobInstance, frameNumber - 1, startFrame);
            }
        }
    };

    private onNextFrame = (): void => {
        const { nextButtonType } = this.state;
        const { frameNumber, jobInstance, playing, onSwitchPlay, searchAnnotations, searchEmptyFrame } = this.props;
        const { stopFrame } = jobInstance;

        const newFrame = Math.min(jobInstance.stopFrame, frameNumber + 1);
        if (newFrame !== frameNumber) {
            if (playing) {
                onSwitchPlay(false);
            }
            if (nextButtonType === 'regular') {
                this.changeFrame(newFrame);
            } else if (nextButtonType === 'filtered') {
                searchAnnotations(jobInstance, frameNumber + 1, stopFrame);
            } else {
                searchEmptyFrame(jobInstance, frameNumber + 1, stopFrame);
            }
        }
    };

    private onForward = (): void => {
        const { frameNumber, frameStep, jobInstance, playing, onSwitchPlay } = this.props;

        const newFrame = Math.min(jobInstance.stopFrame, frameNumber + frameStep);
        if (newFrame !== frameNumber) {
            if (playing) {
                onSwitchPlay(false);
            }
            this.changeFrame(newFrame);
        }
    };

    private onLastFrame = (): void => {
        const { frameNumber, jobInstance, playing, onSwitchPlay } = this.props;

        const newFrame = jobInstance.stopFrame;
        if (newFrame !== frameNumber) {
            if (playing) {
                onSwitchPlay(false);
            }
            this.changeFrame(newFrame);
        }
    };

    private onSetPreviousButtonType = (type: 'regular' | 'filtered' | 'empty'): void => {
        this.setState({
            prevButtonType: type,
        });
    };

    private onSetNextButtonType = (type: 'regular' | 'filtered' | 'empty'): void => {
        this.setState({
            nextButtonType: type,
        });
    };

    private onSaveAnnotation = (): void => {
        const { onSaveAnnotation, jobInstance } = this.props;
        onSaveAnnotation(jobInstance);
    };

    private onChangePlayerSliderValue = (value: SliderValue): void => {
        const { playing, onSwitchPlay } = this.props;
        if (playing) {
            onSwitchPlay(false);
        }
        this.changeFrame(value as number);
    };

    private onChangePlayerInputValue = (value: number): void => {
        const { onSwitchPlay, playing, frameNumber } = this.props;
        if (value !== frameNumber) {
            if (playing) {
                onSwitchPlay(false);
            }
            this.changeFrame(value);
        }
    };

    private onURLIconClick = (): void => {
        const { frameNumber } = this.props;
        const { origin, pathname } = window.location;
        const url = `${origin}${pathname}?frame=${frameNumber}`;
        copy(url);
    };

    private beforeUnloadCallback = (event: BeforeUnloadEvent): string | undefined => {
        const { jobInstance } = this.props;
        if (jobInstance.annotations.hasUnsavedChanges()) {
            const confirmationMessage = 'You have unsaved changes, please confirm leaving this page.';
            // eslint-disable-next-line no-param-reassign
            event.returnValue = confirmationMessage;
            return confirmationMessage;
        }
        return undefined;
    };

    private autoSave(): void {
        const { autoSave, saving } = this.props;

        if (autoSave && !saving) {
            this.onSaveAnnotation();
        }
    }

    private changeFrame(frame: number): void {
        const { onChangeFrame, canvasInstance } = this.props;
        if (canvasInstance.isAbleToChangeFrame()) {
            onChangeFrame(frame);
        }
    }

    public render(): JSX.Element {
        const { nextButtonType, prevButtonType } = this.state;
        const {
            playing,
            saving,
            savingStatuses,
            jobInstance,
            jobInstance: { startFrame, stopFrame },
            frameNumber,
            frameFilename,
            undoAction,
            redoAction,
            workspace,
            canvasIsReady,
            searchAnnotations,
            changeWorkspace,
            keyMap,
            normalizedKeyMap,
            canvasInstance,
        } = this.props;

        const preventDefault = (event: KeyboardEvent | undefined): void => {
            if (event) {
                event.preventDefault();
            }
        };

        const subKeyMap = {
            SAVE_JOB: keyMap.SAVE_JOB,
            UNDO: keyMap.UNDO,
            REDO: keyMap.REDO,
            NEXT_FRAME: keyMap.NEXT_FRAME,
            PREV_FRAME: keyMap.PREV_FRAME,
            FORWARD_FRAME: keyMap.FORWARD_FRAME,
            BACKWARD_FRAME: keyMap.BACKWARD_FRAME,
            SEARCH_FORWARD: keyMap.SEARCH_FORWARD,
            SEARCH_BACKWARD: keyMap.SEARCH_BACKWARD,
            PLAY_PAUSE: keyMap.PLAY_PAUSE,
            FOCUS_INPUT_FRAME: keyMap.FOCUS_INPUT_FRAME,
        };

        const handlers = {
            UNDO: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (undoAction) {
                    this.undo();
                }
            },
            REDO: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (redoAction) {
                    this.redo();
                }
            },
            SAVE_JOB: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (!saving) {
                    this.onSaveAnnotation();
                }
            },
            NEXT_FRAME: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (canvasIsReady) {
                    this.onNextFrame();
                }
            },
            PREV_FRAME: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (canvasIsReady) {
                    this.onPrevFrame();
                }
            },
            FORWARD_FRAME: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (canvasIsReady) {
                    this.onForward();
                }
            },
            BACKWARD_FRAME: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (canvasIsReady) {
                    this.onBackward();
                }
            },
            SEARCH_FORWARD: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (frameNumber + 1 <= stopFrame && canvasIsReady && canvasInstance.isAbleToChangeFrame()) {
                    searchAnnotations(jobInstance, frameNumber + 1, stopFrame);
                }
            },
            SEARCH_BACKWARD: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (frameNumber - 1 >= startFrame && canvasIsReady && canvasInstance.isAbleToChangeFrame()) {
                    searchAnnotations(jobInstance, frameNumber - 1, startFrame);
                }
            },
            PLAY_PAUSE: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                this.onSwitchPlay();
            },
            FOCUS_INPUT_FRAME: (event: KeyboardEvent | undefined) => {
                preventDefault(event);
                if (this.inputFrameRef.current) {
                    this.inputFrameRef.current.focus();
                }
            },
        };

        return (
            <>
                <GlobalHotKeys keyMap={subKeyMap} handlers={handlers} allowChanges />
                <AnnotationTopBarComponent
                    showStatistics={this.showStatistics}
                    onSwitchPlay={this.onSwitchPlay}
                    onSaveAnnotation={this.onSaveAnnotation}
                    onPrevFrame={this.onPrevFrame}
                    onNextFrame={this.onNextFrame}
                    onForward={this.onForward}
                    onBackward={this.onBackward}
                    onFirstFrame={this.onFirstFrame}
                    onSaveVideo={this.onSaveVideo}
                    onLastFrame={this.onLastFrame}
                    setNextButtonType={this.onSetNextButtonType}
                    setPrevButtonType={this.onSetPreviousButtonType}
                    onSliderChange={this.onChangePlayerSliderValue}
                    onInputChange={this.onChangePlayerInputValue}
                    onURLIconClick={this.onURLIconClick}
                    changeWorkspace={changeWorkspace}
                    workspace={workspace}
                    playing={playing}
                    saving={saving}
                    savingStatuses={savingStatuses}
                    startFrame={startFrame}
                    stopFrame={stopFrame}
                    frameNumber={frameNumber}
                    frameFilename={frameFilename}
                    inputFrameRef={this.inputFrameRef}
                    undoAction={undoAction}
                    redoAction={redoAction}
                    saveShortcut={normalizedKeyMap.SAVE_JOB}
                    undoShortcut={normalizedKeyMap.UNDO}
                    redoShortcut={normalizedKeyMap.REDO}
                    playPauseShortcut={normalizedKeyMap.PLAY_PAUSE}
                    nextFrameShortcut={normalizedKeyMap.NEXT_FRAME}
                    previousFrameShortcut={normalizedKeyMap.PREV_FRAME}
                    forwardShortcut={normalizedKeyMap.FORWARD_FRAME}
                    backwardShortcut={normalizedKeyMap.BACKWARD_FRAME}
                    nextButtonType={nextButtonType}
                    prevButtonType={prevButtonType}
                    focusFrameInputShortcut={normalizedKeyMap.FOCUS_INPUT_FRAME}
                    onUndoClick={this.undo}
                    onRedoClick={this.redo}
                />
            </>
        );
    }
}

export default withRouter(connect(mapStateToProps, mapDispatchToProps)(AnnotationTopBarContainer));
