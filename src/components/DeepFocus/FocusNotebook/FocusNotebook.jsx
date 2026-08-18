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
    generateAIPlaylistForTaskText,
    notes = [],
    addFocusNote,
    updateFocusNote,
    deleteFocusNote,
  } = useApp();

  const { replanSession, timerRunning, isBreakMode } = useTimer();

  const [activeTab, setActiveTab] = useState('tasks'); // 'tasks' | 'notes'
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);

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

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (!newNoteTitle.trim() && !newNoteText.trim()) return;
    await addFocusNote(newNoteTitle.trim() || 'Focus Note', newNoteText.trim());
    setNewNoteTitle('');
    setNewNoteText('');
    setIsAddingNote(false);
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
            <div className={styles.tabBar}>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'tasks' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('tasks')}
              >
                Tasks ({completedCount}/{tasks.length})
              </button>
              <button
                type="button"
                className={`${styles.tabBtn} ${activeTab === 'notes' ? styles.tabBtnActive : ''}`}
                onClick={() => setActiveTab('notes')}
              >
                Notes ({notes.length})
              </button>
            </div>
          </div>
          <div className={styles.headerRight}>
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
          {activeTab === 'notes' ? (
            <div className={styles.notesContainer}>
              {!isAddingNote ? (
                <button 
                  type="button"
                  className={styles.addNoteHeaderBtn} 
                  onClick={() => setIsAddingNote(true)}
                >
                  <span>+ Add Session Note</span>
                </button>
              ) : (
                <form onSubmit={handleCreateNote} className={styles.newNoteForm}>
                  <input
                    type="text"
                    className={styles.newNoteTitleInput}
                    placeholder="Note Title (e.g. Core formula, bug fix summary)..."
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    autoFocus
                  />
                  <textarea
                    className={styles.newNoteTextarea}
                    placeholder="Write your note details here..."
                    value={newNoteText}
                    onChange={(e) => setNewNoteText(e.target.value)}
                    rows={3}
                  />
                  <div className={styles.newNoteActions}>
                    <button 
                      type="button" 
                      className={styles.cancelNoteBtn} 
                      onClick={() => { setIsAddingNote(false); setNewNoteTitle(''); setNewNoteText(''); }}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className={styles.saveNoteBtn}
                      disabled={!newNoteTitle.trim() && !newNoteText.trim()}
                    >
                      Save Note
                    </button>
                  </div>
                </form>
              )}

              {notes.length === 0 && !isAddingNote ? (
                <div className={styles.emptyNotesState}>
                  <span className={styles.emptyNotesIcon}>📝</span>
                  <p className={styles.emptyNotesTitle}>No session notes yet</p>
                  <p className={styles.emptyNotesSubtitle}>Jot down equations, reminders, or insights as you work.</p>
                </div>
              ) : (
                <div className={styles.notesList}>
                  {notes.map((note) => (
                    <div key={note.noteId} className={styles.noteCard}>
                      <div className={styles.noteCardHeader}>
                        <input
                          type="text"
                          className={styles.noteCardTitle}
                          value={note.title || ''}
                          onChange={(e) => updateFocusNote(note.noteId, e.target.value, note.text || '')}
                          placeholder="Untitled Note"
                        />
                        <button
                          type="button"
                          className={styles.noteDeleteBtn}
                          onClick={() => deleteFocusNote(note.noteId)}
                          title="Delete note"
                          aria-label="Delete note"
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          </svg>
                        </button>
                      </div>
                      <textarea
                        className={styles.noteCardBody}
                        value={note.text || ''}
                        onChange={(e) => updateFocusNote(note.noteId, note.title || '', e.target.value)}
                        placeholder="Type your notes..."
                        rows={3}
                      />
                      <div className={styles.noteCardFooter}>
                        <span className={styles.noteDate}>
                          {note.updatedAt ? new Date(note.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
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
                      {/* Top Row: Reorder Handle, Checkbox, Text, Meta, Status */}
                      <div className={styles.taskHeaderRow}>
                        {/* Drag Handle */}
                        <div
                          className={styles.dragHandle}
                          onMouseEnter={() => setDraggableIndex(i)}
                          onMouseLeave={() => setDraggableIndex(null)}
                          title="Drag to reorder"
                          aria-label="Drag handle"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="9" cy="6" r="1.5" fill="currentColor" />
                            <circle cx="15" cy="6" r="1.5" fill="currentColor" />
                            <circle cx="9" cy="12" r="1.5" fill="currentColor" />
                            <circle cx="15" cy="12" r="1.5" fill="currentColor" />
                            <circle cx="9" cy="18" r="1.5" fill="currentColor" />
                            <circle cx="15" cy="18" r="1.5" fill="currentColor" />
                          </svg>
                        </div>

                        {/* Interactive Checkbox */}
                        <button
                          className={`${styles.taskCheckbox} ${task.completed ? styles.checked : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleTask(i);
                          }}
                          aria-label={task.completed ? "Mark task incomplete" : "Mark task complete"}
                          title={task.completed ? "Mark incomplete" : "Mark complete"}
                        >
                          {task.completed && <span className={styles.checkMarkIcon}>✓</span>}
                        </button>

                        {/* Task Main Area (Click to expand/collapse) */}
                        <div 
                          className={styles.taskMainContent}
                          onClick={(e) => handleTaskClick(i, e)}
                        >
                          <span className={styles.taskText}>{task.text}</span>
                          <div className={styles.taskMetaRow}>
                            {pomoProgressText && (
                              <span className={styles.pomoProgressBadge}>{pomoProgressText}</span>
                            )}
                            <span className={styles.categoryBadge}>{task.executionLabel || task.category || 'Deep Work'}</span>
                            {task.executionPriority && (
                              <span className={`${styles.priorityBadge} ${styles['prio' + task.executionPriority]}`}>
                                {task.executionPriority}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Status Label & Chevron */}
                        <div 
                          className={styles.statusAndExpand}
                          onClick={(e) => handleTaskClick(i, e)}
                        >
                          <span className={`${styles.statusLabel} ${styles['status' + status.replace(/\s+/g, '')]}`}>
                            {status}
                          </span>
                          <button
                            type="button"
                            className={`${styles.expandChevronBtn} ${isExpanded ? styles.chevronOpen : ''}`}
                            aria-label={isExpanded ? "Collapse task details" : "Expand task details"}
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="6 9 12 15 18 9" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Expanded Details Pane */}
                      {isExpanded && (
                        <div className={styles.taskDetailsPane}>
                          {/* Duration Selector for Focus tasks */}
                          {isFocusTask && (
                            <div className={styles.detailsSection}>
                              <div className={styles.detailsHeaderRow}>
                                <span className={styles.detailsLabel}>Duration</span>
                                <button
                                  type="button"
                                  className={styles.deleteTaskBtn}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    deleteTask(i);
                                  }}
                                  title="Delete task from focus plan"
                                  aria-label="Delete task"
                                >
                                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <polyline points="3 6 5 6 21 6" />
                                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                    <line x1="10" y1="11" x2="10" y2="17" />
                                    <line x1="14" y1="11" x2="14" y2="17" />
                                  </svg>
                                  <span>Delete Task</span>
                                </button>
                              </div>
                              <div className={styles.durationSelectorWrap}>
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
          </>
        )}
      </div>

        {/* Optional Actions (Bottom of notebook) - Only for Tasks tab */}
        {activeTab === 'tasks' && (
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
        )}
      </div>
    </div>
  );
}
