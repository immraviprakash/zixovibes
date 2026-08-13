import { useState, useEffect, useRef } from 'react';
import { useApp } from '../../../context/AppContext';
import { useTimer } from '../../../context/TimerContext';
import { focusPlaylists } from '../../../data/focusData';
import styles from './FocusNotebook.module.css';



export default function FocusNotebook() {
  const {
    tasks,
    setTasks,
    toggleTask,
    notebookOpen,
    setNotebookOpen,
    sessionTitle,
    sessionSubtitle,
    setSessionTitle,
    setSessionSubtitle,
    setEstimatedDuration,
    setSuggestedPomodoros,
    setMotivationalNote,
    setActivePlaylist,
    setCurrentSong,
    songs,
    selectedFocusPlaylist,
    currentPomodoroIndex,
    flattenedPomodoros,
    allTasksDone,
    deleteTask,
    updateTaskDuration,
    reorderTasks,
    generateAIPlaylistForTaskText
  } = useApp();

  const { replanSession, timerRunning, isBreakMode } = useTimer();

  const [expandedTaskIndex, setExpandedTaskIndex] = useState(null);
  const [isReplanning, setIsReplanning] = useState(false);
  const [replanInput, setReplanInput] = useState('');
  const [newTaskText, setNewTaskText] = useState('');
  const [isSubmittingReplan, setIsSubmittingReplan] = useState(false);
  
  const [replanError, setReplanError] = useState('');
  const [addTaskError, setAddTaskError] = useState('');

  const [openSelectIndex, setOpenSelectIndex] = useState(null);
  const selectWrapperRef = useRef(null);

  const [draggableIndex, setDraggableIndex] = useState(null);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [draggedOverIndex, setDraggedOverIndex] = useState(null);
  const [dropPosition, setDropPosition] = useState(null); // 'above' | 'below'

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', index);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDraggedOverIndex(null);
    setDropPosition(null);
    setDraggableIndex(null);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) {
      setDraggedOverIndex(null);
      setDropPosition(null);
      return;
    }

    const rect = e.currentTarget.getBoundingClientRect();
    const relativeY = e.clientY - rect.top;
    const isAbove = relativeY < rect.height / 2;

    setDraggedOverIndex(index);
    setDropPosition(isAbove ? 'above' : 'below');
  };

  const handleDragLeave = () => {
    // Only handles clearing when dragging off element
  };

  const handleDrop = (e, index) => {
    e.preventDefault();
    if (draggedIndex !== null && draggedIndex !== index) {
      let targetIndex = index;
      if (dropPosition === 'below') {
        targetIndex = targetIndex + 1;
      }

      let newIndex = targetIndex;
      if (draggedIndex < targetIndex) {
        newIndex = targetIndex - 1;
      }

      if (newIndex !== draggedIndex) {
        reorderTasks(draggedIndex, newIndex);
      }
    }

    handleDragEnd();
  };

  // Click outside listener for custom estimated duration dropdown
  useEffect(() => {
    if (openSelectIndex === null) return;
    const handleClickOutside = (e) => {
      if (selectWrapperRef.current && !selectWrapperRef.current.contains(e.target)) {
        setOpenSelectIndex(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [openSelectIndex]);

  // Close custom select dropdown if task is collapsed/changed
  useEffect(() => {
    setOpenSelectIndex(null);
  }, [expandedTaskIndex]);

  const completedCount = Array.isArray(tasks) ? tasks.filter(t => t.completed).length : 0;

  const handleClose = (e) => {
    e.stopPropagation();
    setNotebookOpen(false);
    setIsReplanning(false);
  };

  const handleTaskClick = (index, e) => {
    e.stopPropagation();
    setExpandedTaskIndex(prev => (prev === index ? null : index));
  };

  const handleReplanSubmit = async (e) => {
    e.preventDefault();
    if (!replanInput.trim() || isSubmittingReplan) return;
    setIsSubmittingReplan(true);
    setReplanError('');
    
    try {
      await replanSession(replanInput);
      setReplanInput('');
      setIsReplanning(false);
    } catch (err) {
      console.error('[Notebook] Replan error:', err);
      setReplanError(err.message || "I encountered a slight issue organizing your focus plan. Let's try again in a moment.");
    } finally {
      setIsSubmittingReplan(false);
    }
  };

  const handleAddTask = (e) => {
    e.preventDefault();
    if (!newTaskText.trim()) return;
    setAddTaskError('');

    const text = newTaskText.trim();
    const newTask = {
      id: `task_${Date.now()}_manual`,
      text,
      completed: false,
      taskType: 'focus',
      pomodoros: [text],
      synopsis: `This session is dedicated to successfully executing and completing: ${text}.`,
      category: 'Deep Work',
      workCategory: 'Deep Work',
      executionLabel: 'Deep Work',
      executionPriority: 'Medium',
      status: tasks.length === 0 ? 'Ready' : 'Planned',
      estimatedDuration: 25,
      pomodoroCount: 1,
      pomodoroDurations: [25]
    };

    setTasks(prev => {
      const next = [...prev, newTask];
      
      let totalPomos = 0;
      let totalMinutes = 0;
      next.forEach(t => {
        totalPomos += t.pomodoroCount || 0;
        totalMinutes += typeof t.estimatedDuration === 'number' ? t.estimatedDuration : ((t.pomodoroCount || 0) * 25);
      });
      setSuggestedPomodoros(totalPomos);
      
      const hours = Math.floor(totalMinutes / 60);
      const mins = totalMinutes % 60;
      setEstimatedDuration(
        hours > 0
          ? `${hours} Hour${hours > 1 ? 's' : ''}${mins > 0 ? ` ${mins} Minutes` : ''}`
          : `${mins} Minutes`
      );
      
      return next;
    });

    const updatedTasks = [...tasks, newTask];
    const focusTasks = updatedTasks.filter(t => !t.taskType || t.taskType === 'focus');
    const focusDurationMins = focusTasks.reduce((sum, t) => {
      const duration = typeof t.estimatedDuration === 'number'
        ? t.estimatedDuration
        : ((t.pomodoroCount || t.pomodoros?.length || 0) * 25);
      return sum + duration;
    }, 0);
    generateAIPlaylistForTaskText(text, focusDurationMins * 60);
    setNewTaskText('');
  };

  return (
    <div 
      className={`${styles.panel} ${notebookOpen ? styles.open : ''}`}
      style={{ height: notebookOpen ? '450px' : undefined }}
    >
      <div className={styles.resizeHandle} />
      <div className={styles.inner}>
        {/* Header */}
        <div className={styles.header}>
          <div className={styles.headerLeft}>
            <h3 className={styles.title}>Focus Planner</h3>
          </div>
          <div className={styles.headerRight}>
            <span className={styles.counter}>
              {completedCount}/{tasks.length} Tasks
            </span>
            <button
              className={styles.closeBtn}
              onClick={handleClose}
              aria-label="Close Planner"
              title="Close Workspace Expansion"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content Scroll Area */}
        <div className={styles.scrollArea}>
          {/* Completion Banner */}
          {allTasksDone && (
            <div className={styles.completedBanner}>
              <span className={styles.completedCheck}>✓</span>
              <div className={styles.completedTexts}>
                <span className={styles.completedTitle}>Focus Plan Completed</span>
                <p className={styles.completedSubtitle}>
                  You are free to continue working or create a new plan.
                </p>
              </div>
            </div>
          )}

          {/* Tasks List */}
          <div className={styles.taskList}>
            {!Array.isArray(tasks) || tasks.length === 0 ? (
              <div className={styles.emptyState}>No tasks in focus plan.</div>
            ) : (
              tasks.map((task, i) => {
              const isExpanded = expandedTaskIndex === i;
              
              const getTaskStatus = () => {
                if (task.completed || task.status === 'Completed') return 'Completed';
                if (task.status === 'Deferred') return 'Deferred';
                if (task.status === 'Skipped') return 'Skipped';
                if (task.status === 'Cancelled') return 'Cancelled';

                if (task.taskType && task.taskType !== 'focus') {
                  return task.status || 'Planned';
                }

                const activePomodoro = flattenedPomodoros[currentPomodoroIndex];
                if (activePomodoro && activePomodoro.taskIndex === i) {
                  if (isBreakMode) {
                    return 'Starting Soon';
                  }
                  return timerRunning ? 'In Progress' : 'Ready';
                }
                
                if (activePomodoro && activePomodoro.taskIndex > i) {
                  return 'Completed';
                }
                
                return task.status || 'Planned';
              };

              const status = getTaskStatus();
              
              const totalPomos = task.pomodoros ? task.pomodoros.length : 1;
              const taskPomos = flattenedPomodoros.filter(fp => fp.taskIndex === i);
              const completedTaskPomos = taskPomos.filter(fp => fp.executionIndex < currentPomodoroIndex).length;
              
              let pomoProgressText = '';
              const isFocusTask = !task.taskType || task.taskType === 'focus';
              if (isFocusTask) {
                if (task.completed || status === 'Completed') {
                  pomoProgressText = `Pomodoro ${totalPomos} of ${totalPomos}`;
                } else {
                  const isActive = taskPomos.some(fp => fp.executionIndex === currentPomodoroIndex);
                  if (isActive) {
                    pomoProgressText = `Pomodoro ${Math.min(completedTaskPomos + 1, totalPomos)} of ${totalPomos}`;
                  } else if (completedTaskPomos >= totalPomos) {
                    pomoProgressText = `Pomodoro ${totalPomos} of ${totalPomos}`;
                  } else {
                    pomoProgressText = `Pomodoro ${Math.max(1, completedTaskPomos + 1)} of ${totalPomos}`;
                  }
                }
              }

              return (
                <div 
                  key={task.id || i} 
                  className={`${styles.taskContainer} ${isExpanded ? styles.expanded : ''} ${task.completed || status === 'Completed' ? styles.taskCompleted : ''} ${status === 'In Progress' ? styles.taskInProgress : ''} ${status === 'Ready' ? styles.taskReady : ''} ${draggedIndex === i ? styles.dragging : ''} ${draggedOverIndex === i && dropPosition === 'above' ? styles.dragOverAbove : ''} ${draggedOverIndex === i && dropPosition === 'below' ? styles.dragOverBelow : ''}`}
                  draggable={draggableIndex === i}
                  onDragStart={(e) => handleDragStart(e, i)}
                  onDragEnd={handleDragEnd}
                  onDragOver={(e) => handleDragOver(e, i)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, i)}
                >
                  <div
                    className={`${styles.taskRow} ${task.completed ? styles.completed : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => handleTaskClick(i, e)}
                    onKeyDown={(e) => {
                      if (e.key === ' ' || e.key === 'Enter') {
                        e.preventDefault();
                        handleTaskClick(i, e);
                      }
                    }}
                    aria-expanded={isExpanded}
                    aria-label={`${isExpanded ? 'Collapse' : 'Expand'} details for ${task.text}`}
                  >
                    {/* Subtle Drag Handle grid icon */}
                    <div
                      className={styles.dragHandle}
                      draggable={false}
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggableIndex(i);
                      }}
                      onMouseUp={(e) => {
                        e.stopPropagation();
                        setDraggableIndex(null);
                      }}
                      title="Drag to reorder"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <circle cx="9" cy="5" r="1.5" fill="currentColor"/>
                        <circle cx="15" cy="5" r="1.5" fill="currentColor"/>
                        <circle cx="9" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="15" cy="12" r="1.5" fill="currentColor"/>
                        <circle cx="9" cy="19" r="1.5" fill="currentColor"/>
                        <circle cx="15" cy="19" r="1.5" fill="currentColor"/>
                      </svg>
                    </div>

                    <div
                      className={styles.checkbox}
                      role="checkbox"
                      aria-checked={task.completed}
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleTask(i);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === ' ' || e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          toggleTask(i);
                        }
                      }}
                      aria-label={`Toggle task: ${task.text}`}
                    >
                      {task.completed && (
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="4.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                    <div className={styles.taskContentCol}>
                      <div className={styles.taskTextRow}>
                        <span className={styles.taskText}>{task.text}</span>
                      </div>
                      <span className={styles.taskDurationHint}>
                        {isFocusTask ? (
                          `${task.estimatedDuration || (totalPomos * 25)} min • ${pomoProgressText}`
                        ) : task.taskType === 'scheduled' ? (
                          `${task.estimatedDuration ? `${task.estimatedDuration} min • ` : ''}Scheduled Event`
                        ) : task.taskType === 'quick' ? (
                          `${task.estimatedDuration ? `${task.estimatedDuration} min • ` : ''}Quick Action`
                        ) : (
                          `${task.estimatedDuration ? `${task.estimatedDuration} min • ` : ''}Checklist Action`
                        )}
                      </span>
                      <div className={styles.chipRow}>
                        {task.category && (
                          <span className={`${styles.badge} ${styles.categoryBadge}`}>
                            {task.category}
                          </span>
                        )}
                        {task.executionLabel && (
                          <span className={`${styles.badge} ${styles.executionBadge}`}>
                            {task.executionLabel}
                          </span>
                        )}
                        <span className={`${styles.badge} ${styles.statusBadge} ${styles['status' + status.replace(/\s+/g, '')]}`}>
                          {status}
                        </span>
                      </div>
                    </div>
                      <button
                        className={styles.deleteBtn}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTask(i);
                        }}
                        title="Delete Task"
                        aria-label="Delete Task"
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                      <span className={`${styles.toggleArrow} ${isExpanded ? styles.arrowUp : ''}`}>
                        ▼
                      </span>
                    </div>

                    {/* Inline Folder Expansion Details */}
                    {isExpanded && (
                      <div className={styles.folderDetails}>
                        {/* Smart Duration Customization */}
                        {isFocusTask && (
                          <div className={styles.taskControlsRow}>
                            <div className={styles.taskControlItem}>
                              <label className={styles.controlLabel}>Estimated Duration</label>
                              <div 
                                className={`${styles.customSelectWrapper} ${openSelectIndex === i ? styles.customSelectWrapperOpen : ''}`}
                                ref={openSelectIndex === i ? selectWrapperRef : null}
                              >
                                <button
                                  type="button"
                                  className={styles.customSelectTrigger}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setOpenSelectIndex(openSelectIndex === i ? null : i);
                                  }}
                                  aria-label="Select estimated duration"
                                >
                                  <span>
                                    {task.pomodoros ? task.pomodoros.length : 3} Pomodoro{(task.pomodoros ? task.pomodoros.length : 3) > 1 ? 's' : ''} ({(task.pomodoros ? task.pomodoros.length : 3) * 25} min)
                                  </span>
                                  <span className={styles.customSelectArrow}>▼</span>
                                </button>
                                {openSelectIndex === i && (
                                  <div className={styles.customSelectOptions}>
                                    {[1, 2, 3, 4, 5, 6].map(num => (
                                      <button
                                        key={num}
                                        type="button"
                                        className={`${styles.customSelectOption} ${
                                          (task.pomodoros ? task.pomodoros.length : 3) === num ? styles.activeOption : ''
                                        }`}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          updateTaskDuration(i, num);
                                          setOpenSelectIndex(null);
                                        }}
                                      >
                                        {num} Pomodoro{num > 1 ? 's' : ''} ({num * 25} min)
                                      </button>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        <div className={styles.detailsSection}>
                          <span className={styles.detailsLabel}>Synopsis</span>
                          <p className={styles.detailsValueText}>
                            {task.synopsis || `This session will guide you through key learning milestones and focus exercises to successfully complete: ${task.text}.`}
                          </p>
                        </div>

                        {isFocusTask && task.pomodoros && task.pomodoros.length > 0 && (
                          <div className={styles.detailsSection}>
                            <span className={styles.detailsLabel}>Breakdown</span>
                            <div className={styles.breakdownList}>
                              {task.pomodoros.map((stepName, stepIdx) => {
                                const flatIdx = flattenedPomodoros.findIndex(
                                  fp => fp.taskIndex === i && fp.index === stepIdx
                                );
                                const isStepCompleted = flatIdx !== -1 && flatIdx < currentPomodoroIndex;
                                const isStepActive = flatIdx === currentPomodoroIndex;

                                return (
                                  <div
                                    key={stepIdx}
                                    className={`${styles.breakdownItem} ${isStepActive ? styles.stepActive : ''} ${isStepCompleted ? styles.stepCompleted : ''}`}
                                  >
                                    <span className={styles.stepNum}>Pomodoro {stepIdx + 1}:</span>
                                    <span className={styles.stepName}>{stepName}</span>
                                    {isStepCompleted && <span className={styles.stepBadgeCompleted}>✓</span>}
                                    {isStepActive && <span className={styles.stepBadgeActive}>Active</span>}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Optional Actions (Bottom of notebook) */}
        <div className={styles.actionsArea}>
          {/* Add Manual Task Form */}
          <form onSubmit={handleAddTask} className={styles.addTaskForm}>
            <input
              type="text"
              className={styles.addTaskInput}
              value={newTaskText}
              onChange={(e) => setNewTaskText(e.target.value)}
              placeholder="+ Add a manual task..."
              aria-label="New task text"
            />
            <button
              type="submit"
              className={styles.addTaskBtn}
              disabled={!newTaskText.trim()}
              title="Add task manually"
              aria-label="Add manual task button"
            >
              Add
            </button>
          </form>
          {addTaskError && (
            <div style={{ color: '#ff6b6b', fontSize: '0.72rem', marginTop: '4px', paddingLeft: '8px', width: '100%', textAlign: 'left' }}>
              ⚠️ {addTaskError}
            </div>
          )}

          {/* AI Coach Replan Input */}
          {!isReplanning ? (
            <button
              className={styles.replanTriggerBtn}
              onClick={() => setIsReplanning(true)}
              title="Tell AI Coach how your plans changed"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className={styles.coachIcon}>
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <span>Update Focus Plan</span>
            </button>
          ) : (
            <form onSubmit={handleReplanSubmit} className={styles.replanForm}>
              <span className={styles.replanTitle}>Explain your schedule changes to AI Coach:</span>
              <textarea
                className={styles.replanTextarea}
                value={replanInput}
                onChange={(e) => setReplanInput(e.target.value)}
                placeholder="e.g. Finished revision. Need to prepare notes now."
                rows={2}
                autoFocus
              />
              {replanError && (
                <div style={{ color: '#ff6b6b', fontSize: '0.72rem', marginBottom: '8px', width: '100%', textAlign: 'left' }}>
                  ⚠️ {replanError}
                </div>
              )}
              <div className={styles.replanActions}>
                <button
                  type="button"
                  className={styles.replanCancelBtn}
                  onClick={() => setIsReplanning(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.replanConfirmBtn}
                  disabled={!replanInput.trim() || isSubmittingReplan}
                  aria-label="Replan schedule"
                >
                  {isSubmittingReplan ? "Replanning..." : "Replan"}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
