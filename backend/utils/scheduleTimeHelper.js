/**
 * Utility to parse scheduled date and timeSlot string into { startTime, endTime } Date objects.
 */
const parseTimeSlotWindow = (scheduledDate, timeSlotStr, durationMinutes = 60) => {
  if (!scheduledDate) return { startTime: null, endTime: null };
  const baseDate = new Date(scheduledDate);
  if (isNaN(baseDate.getTime())) return { startTime: null, endTime: null };
  const year = baseDate.getFullYear();
  const month = baseDate.getMonth();
  const day = baseDate.getDate();

  if (!timeSlotStr || typeof timeSlotStr !== "string" || !timeSlotStr.trim()) {
    return {
      startTime: new Date(year, month, day, 0, 0, 0, 0),
      endTime: new Date(year, month, day, 23, 59, 59, 999),
    };
  }

  const cleanSlot = timeSlotStr.trim();
  const parts = cleanSlot.split(/\s*(?:-|–|—|to)\s*/i);

  const parseTimePart = (str, defaultAmPm = null) => {
    if (!str) return null;
    const s = str.trim().toUpperCase();
    const isPM = s.includes("PM");
    const isAM = s.includes("AM");
    const cleanStr = s.replace(/AM|PM/gi, "").trim();

    const colonParts = cleanStr.split(":");
    let hour = parseInt(colonParts[0], 10);
    let minute = colonParts.length > 1 ? parseInt(colonParts[1], 10) : 0;

    if (isNaN(hour)) return null;
    if (isNaN(minute)) minute = 0;

    if (isPM) {
      if (hour < 12) hour += 12;
    } else if (isAM) {
      if (hour === 12) hour = 0;
    } else if (defaultAmPm) {
      if (defaultAmPm === "PM" && hour < 12) hour += 12;
      if (defaultAmPm === "AM" && hour === 12) hour = 0;
    }

    return { hour, minute };
  };

  let startParsed = null;
  let endParsed = null;

  if (parts.length >= 2) {
    const endHasAM = parts[1].toUpperCase().includes("AM");
    const endHasPM = parts[1].toUpperCase().includes("PM");
    const defaultAmPm = endHasPM ? "PM" : endHasAM ? "AM" : null;
    startParsed = parseTimePart(parts[0], defaultAmPm);
    endParsed = parseTimePart(parts[1], null);
  } else {
    startParsed = parseTimePart(parts[0], null);
  }

  if (!startParsed) {
    return {
      startTime: new Date(year, month, day, 0, 0, 0, 0),
      endTime: new Date(year, month, day, 23, 59, 59, 999),
    };
  }

  const startTime = new Date(year, month, day, startParsed.hour, startParsed.minute, 0, 0);
  let endTime;

  if (endParsed) {
    endTime = new Date(year, month, day, endParsed.hour, endParsed.minute, 0, 0);
    if (endTime <= startTime) {
      endTime = new Date(startTime.getTime() + (durationMinutes || 60) * 60 * 1000);
    }
  } else {
    endTime = new Date(startTime.getTime() + (durationMinutes || 60) * 60 * 1000);
  }

  return { startTime, endTime };
};

/**
 * Returns dynamic schedule status: 'Upcoming', 'Active', 'Completed', or 'Missed'
 */
const evaluateScheduleStatus = (schedule, application = null, now = new Date()) => {
  if (schedule.status === "Cancelled") return "Cancelled";
  if (schedule.status === "Completed") return "Completed";

  const app = application || schedule.applicationId;
  let isDone = false;

  if (app) {
    if (schedule.eventType === "Aptitude" && (app.aptitude?.status === "Passed" || app.aptitude?.status === "Failed" || (app.aptitude?.score !== null && app.aptitude?.score !== undefined) || app.status === "Aptitude Completed")) {
      isDone = true;
    } else if (schedule.eventType === "GD" && (app.gd?.status === "Shortlisted" || app.gd?.status === "Rejected" || app.gd?.status === "Completed" || app.status === "GD Completed")) {
      isDone = true;
    } else if (schedule.eventType === "Interview" && (app.interview?.result === "Selected" || app.interview?.result === "Rejected" || app.interview?.result === "Waitlisted" || app.status === "Interview Completed")) {
      isDone = true;
    }
  }

  if (isDone) return "Completed";

  const { startTime, endTime } = parseTimeSlotWindow(schedule.date, schedule.timeSlot);
  if (!startTime || !endTime) return schedule.status || "Scheduled";

  if (now > endTime) {
    return "Missed";
  }

  if (now >= startTime && now <= endTime) {
    return "Active";
  }

  return "Upcoming";
};

module.exports = {
  parseTimeSlotWindow,
  evaluateScheduleStatus,
};
