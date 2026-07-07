const STORAGE_KEY = "daily-water-tracker-v1";
const quickAmounts = [150, 250, 350, 500];
const maxCustomAmountAfterTarget = 6000;
const oneDay = 24 * 60 * 60 * 1000;

const defaultProfile = {
  sex: "female",
  weight: 60,
  activity: 20,
  hotDay: false,
  pregnant: false,
  lactating: false,
  manualTarget: ""
};

const defaultReminders = {
  enabled: false,
  startMinutes: 9 * 60,
  endMinutes: 17 * 60,
  intervalMinutes: 60
};

const state = loadState();
let selectedDate = startOfDay(new Date());
let reminderTimer = null;
let lastReminderKey = "";

const elements = {
  activeDate: document.querySelector("#active-date"),
  prevDay: document.querySelector("#prev-day"),
  todayButton: document.querySelector("#today-button"),
  nextDay: document.querySelector("#next-day"),
  todayTotal: document.querySelector("#today-total"),
  remainingCopy: document.querySelector("#remaining-copy"),
  targetAmount: document.querySelector("#target-amount"),
  waterFill: document.querySelector("#water-fill"),
  quickButtons: document.querySelector("#quick-buttons"),
  customForm: document.querySelector("#custom-form"),
  customAmount: document.querySelector("#custom-amount"),
  clearDay: document.querySelector("#clear-day"),
  logList: document.querySelector("#log-list"),
  emptyState: document.querySelector("#empty-state"),
  logTemplate: document.querySelector("#log-item-template"),
  weekChart: document.querySelector("#week-chart"),
  weekAverage: document.querySelector("#week-average"),
  profileForm: document.querySelector("#profile-form"),
  resetProfile: document.querySelector("#reset-profile"),
  reminderStatus: document.querySelector("#reminder-status"),
  reminderWindow: document.querySelector("#reminder-window"),
  reminderToggle: document.querySelector("#reminder-toggle"),
  reminderCopy: document.querySelector("#reminder-copy"),
  reminderPlan: document.querySelector("#reminder-plan"),
  reminderSettings: document.querySelector("#reminder-settings"),
  reminderStart: document.querySelector("#reminder-start"),
  reminderEnd: document.querySelector("#reminder-end"),
  reminderInterval: document.querySelector("#reminder-interval"),
  adviceList: document.querySelector("#advice-list"),
  adviceTag: document.querySelector("#advice-tag")
};

init();

function init() {
  renderQuickButtons();
  renderReminderTimeOptions();
  bindEvents();
  syncProfileForm();
  syncReminderSettings();
  render();
  scheduleReminderLoop();
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return {
      logs: saved?.logs && typeof saved.logs === "object" ? saved.logs : {},
      profile: { ...defaultProfile, ...(saved?.profile || {}) },
      reminders: normalizeReminders(saved?.reminders)
    };
  } catch {
    return {
      logs: {},
      profile: { ...defaultProfile },
      reminders: { ...defaultReminders }
    };
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function normalizeReminders(savedReminders = {}) {
  const startMinutes = Number.isFinite(Number(savedReminders.startMinutes))
    ? Number(savedReminders.startMinutes)
    : Number(savedReminders.startHour ?? 9) * 60;
  const endMinutes = Number.isFinite(Number(savedReminders.endMinutes))
    ? Number(savedReminders.endMinutes)
    : Number(savedReminders.endHour ?? 17) * 60;

  return {
    ...defaultReminders,
    ...savedReminders,
    startMinutes: roundToNearest(clampNumber(startMinutes, 0, 23 * 60 + 30, defaultReminders.startMinutes), 30),
    endMinutes: roundToNearest(clampNumber(endMinutes, 0, 23 * 60 + 30, defaultReminders.endMinutes), 30),
    intervalMinutes: clampNumber(
      savedReminders.intervalMinutes,
      15,
      240,
      defaultReminders.intervalMinutes
    )
  };
}

function bindEvents() {
  elements.prevDay.addEventListener("click", () => {
    selectedDate = addDays(selectedDate, -1);
    render();
  });

  elements.nextDay.addEventListener("click", () => {
    selectedDate = addDays(selectedDate, 1);
    render();
  });

  elements.todayButton.addEventListener("click", () => {
    selectedDate = startOfDay(new Date());
    render();
  });

  elements.customForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addDrink(getCustomDrinkAmount());
  });

  elements.clearDay.addEventListener("click", () => {
    const key = dateKey(selectedDate);
    if (!state.logs[key]?.length) return;
    state.logs[key] = [];
    saveState();
    render();
  });

  elements.profileForm.addEventListener("input", () => {
    const form = new FormData(elements.profileForm);
    state.profile = {
      sex: form.get("sex") || "female",
      weight: clampNumber(form.get("weight"), 30, 180, defaultProfile.weight),
      activity: clampNumber(form.get("activity"), 0, 360, defaultProfile.activity),
      hotDay: form.get("hotDay") === "on",
      pregnant: form.get("pregnant") === "on",
      lactating: form.get("lactating") === "on",
      manualTarget: normalizeOptionalNumber(form.get("manualTarget"), 800, 6000)
    };
    saveState();
    render();
  });

  elements.resetProfile.addEventListener("click", () => {
    state.profile = { ...defaultProfile };
    saveState();
    syncProfileForm();
    render();
  });

  elements.reminderToggle.addEventListener("click", async () => {
    if (!canUseNativeNotifier() && !("Notification" in window)) {
      state.reminders.enabled = false;
      saveState();
      render();
      return;
    }

    if (state.reminders.enabled) {
      state.reminders.enabled = false;
      saveState();
      scheduleReminderLoop();
      render();
      return;
    }

    state.reminders.enabled = await ensureNotificationPermission();
    saveState();
    scheduleReminderLoop();
    render();
    if (state.reminders.enabled) {
      sendReminderNotificationLater(
        "喝水提醒已开启",
        `之后会在 ${formatMinutesOfDay(state.reminders.startMinutes)}-${formatMinutesOfDay(state.reminders.endMinutes)} 通过系统通知提醒你喝水。`
      );
    }
  });

  elements.reminderSettings.addEventListener("input", () => {
    const startMinutes = parseTimeMinutes(elements.reminderStart.value, defaultReminders.startMinutes);
    const endMinutes = parseTimeMinutes(elements.reminderEnd.value, defaultReminders.endMinutes);
    const intervalMinutes = clampNumber(
      elements.reminderInterval.value,
      15,
      240,
      defaultReminders.intervalMinutes
    );
    state.reminders.startMinutes = Math.min(startMinutes, endMinutes);
    state.reminders.endMinutes = Math.max(startMinutes, endMinutes);
    state.reminders.intervalMinutes = intervalMinutes;
    syncReminderSettings();
    saveState();
    scheduleReminderLoop();
    render();
  });
}

function renderQuickButtons() {
  elements.quickButtons.innerHTML = "";
  quickAmounts.forEach((amount) => {
    const button = document.createElement("button");
    button.type = "button";
    button.innerHTML = `<strong>+${amount} ml</strong><span>${labelForAmount(amount)}</span>`;
    button.addEventListener("click", () => addDrink(amount));
    elements.quickButtons.append(button);
  });
}

function renderReminderTimeOptions() {
  const options = Array.from({ length: 48 }, (_, index) => {
    const minutes = index * 30;
    const option = document.createElement("option");
    option.value = formatMinutesOfDay(minutes);
    option.textContent = formatMinutesOfDay(minutes);
    return option;
  });

  elements.reminderStart.replaceChildren(...options.map((option) => option.cloneNode(true)));
  elements.reminderEnd.replaceChildren(...options);
}

function addDrink(amount) {
  const normalized = Math.round(Number(amount));
  if (!Number.isFinite(normalized) || normalized <= 0) return;
  const key = dateKey(selectedDate);
  const now = new Date();
  const logTime = new Date(selectedDate);
  logTime.setHours(now.getHours(), now.getMinutes(), 0, 0);

  state.logs[key] = [
    ...(state.logs[key] || []),
    {
      id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      amount: normalized,
      time: logTime.toISOString()
    }
  ];

  saveState();
  render();
  playWaterSplash();
}

function removeDrink(id) {
  const key = dateKey(selectedDate);
  state.logs[key] = (state.logs[key] || []).filter((item) => item.id !== id);
  saveState();
  render();
}

function render() {
  const key = dateKey(selectedDate);
  const logs = state.logs[key] || [];
  const total = sumLogs(logs);
  const target = calculateTarget(state.profile);
  const recommendedTarget = calculateRecommendedTarget(state.profile);
  const percentage = Math.min(100, Math.round((total / target) * 100));
  const remaining = Math.max(0, target - total);
  const overage = Math.max(0, total - target);

  elements.activeDate.textContent = formatDate(selectedDate);
  elements.activeDate.dateTime = key;
  elements.nextDay.disabled = isToday(selectedDate);
  elements.todayButton.hidden = isToday(selectedDate);
  elements.todayTotal.textContent = `${formatNumber(total)} ml`;
  elements.targetAmount.textContent = `${formatNumber(target)} ml`;
  elements.profileForm.elements.manualTarget.placeholder = `${formatNumber(recommendedTarget)} ml`;
  elements.remainingCopy.textContent =
    remaining > 0
      ? `距离目标还差 ${formatNumber(remaining)} ml`
      : overage > 0
        ? `已超过今日目标 ${formatNumber(overage)} ml，仍可继续记录`
        : "已达到今日目标";
  elements.remainingCopy.className = "progress-status";
  elements.remainingCopy.classList.add(getHydrationStatusClass(remaining, overage));
  elements.waterFill.classList.remove("is-under", "is-complete", "is-over");
  elements.waterFill.classList.add(getHydrationStatusClass(remaining, overage));
  elements.waterFill.style.height = `${percentage}%`;
  elements.waterFill.classList.toggle("is-empty", percentage === 0);
  updateCustomAmountInput(remaining);

  renderLogs(logs);
  renderWeek(target);
  renderReminderPlan(target, total);
  renderAdvice(target, total);
}

function getHydrationStatusClass(remaining, overage) {
  if (overage > 0) return "is-over";
  if (remaining === 0) return "is-complete";
  return "is-under";
}

function getCustomDrinkAmount() {
  const value = Math.round(Number(elements.customAmount.value));
  const max = Number(elements.customAmount.max || maxCustomAmountAfterTarget);
  if (!Number.isFinite(value)) return 0;
  return Math.min(max, Math.max(0, value));
}

function updateCustomAmountInput(remaining) {
  const max = remaining > 0 ? remaining : maxCustomAmountAfterTarget;
  elements.customAmount.max = String(max);
  elements.customAmount.title =
    remaining > 0
      ? `请输入 0 到 ${formatNumber(max)} ml 之间的任意整数`
      : `已达标，可继续记录，单次最多 ${formatNumber(maxCustomAmountAfterTarget)} ml`;

  const current = Number(elements.customAmount.value);
  if (Number.isFinite(current) && current > max) {
    elements.customAmount.value = max;
  }
}

function renderLogs(logs) {
  elements.logList.innerHTML = "";
  elements.emptyState.classList.toggle("is-visible", logs.length === 0);

  [...logs].reverse().forEach((item) => {
    const node = elements.logTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".log-amount").textContent = `${formatNumber(item.amount)} ml`;
    node.querySelector(".log-time").textContent = formatTime(new Date(item.time));
    node.querySelector(".delete-log").addEventListener("click", () => removeDrink(item.id));
    elements.logList.append(node);
  });
}

function renderWeek(target) {
  const days = Array.from({ length: 7 }, (_, index) => addDays(selectedDate, index - 6));
  const totals = days.map((day) => sumLogs(state.logs[dateKey(day)] || []));
  const average = Math.round(totals.reduce((sum, value) => sum + value, 0) / totals.length);
  elements.weekAverage.textContent = `均值 ${formatNumber(average)} ml`;
  elements.weekChart.innerHTML = "";
  elements.weekChart.append(createLineChart(totals, target));

  days.forEach((day, index) => {
    const total = totals[index];
    const percentage = Math.min(100, Math.round((total / target) * 100));
    const item = document.createElement("div");
    item.className = `day-bar${total >= target ? " is-complete" : ""}`;
    item.innerHTML = `
      <div class="bar-track"><div class="bar-fill" style="height: ${percentage}%"></div></div>
      <strong>${shortWeekday(day)}</strong>
      <span>${Math.round(total / 10) / 100} L</span>
    `;
    elements.weekChart.append(item);
  });
}

function createLineChart(totals, target) {
  const maxValue = Math.max(target, ...totals, 1);
  const points = totals.map((total, index) => {
    const x = ((index + 0.5) / totals.length) * 100;
    const y = 92 - (total / maxValue) * 76;
    return { x, y };
  });
  const targetY = 92 - (target / maxValue) * 76;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("class", "line-chart");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  const targetLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
  targetLine.setAttribute("class", "line-target");
  targetLine.setAttribute("x1", "0");
  targetLine.setAttribute("x2", "100");
  targetLine.setAttribute("y1", targetY.toFixed(2));
  targetLine.setAttribute("y2", targetY.toFixed(2));
  svg.append(targetLine);

  const polyline = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
  polyline.setAttribute("class", "line-path");
  polyline.setAttribute("points", points.map((point) => `${point.x.toFixed(2)},${point.y.toFixed(2)}`).join(" "));
  svg.append(polyline);

  points.forEach((point) => {
    const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    circle.setAttribute("class", "line-point");
    circle.setAttribute("cx", point.x.toFixed(2));
    circle.setAttribute("cy", point.y.toFixed(2));
    circle.setAttribute("r", "1.8");
    svg.append(circle);
  });

  const targetBadge = document.createElement("div");
  targetBadge.className = "target-line-label";
  targetBadge.style.top = `calc(${targetY.toFixed(2)}% - ${(targetY * 0.42).toFixed(2)}px)`;
  targetBadge.textContent = `建议 ${formatNumber(target)} ml`;

  const fragment = document.createDocumentFragment();
  fragment.append(svg, targetBadge);
  return fragment;
}

function playWaterSplash() {
  elements.waterFill.classList.remove("is-splashing");
  requestAnimationFrame(() => {
    elements.waterFill.classList.add("is-splashing");
  });
}

function renderReminderPlan(target, total) {
  const reminderSlots = getReminderSlots();
  const plan = createReminderPlan(target);
  const todayTotal = sumLogs(state.logs[dateKey(new Date())] || []);
  const now = new Date();
  const nextReminder = getNextReminderDate(now);
  const nextAmount = getSuggestedReminderAmount(now, target, todayTotal);
  const nativeNotifier = canUseNativeNotifier();
  const isNotificationSupported = "Notification" in window;
  const permission = nativeNotifier ? "native" : isNotificationSupported ? Notification.permission : "unsupported";
  const notificationEnabled = state.reminders.enabled && (nativeNotifier || permission === "granted");

  elements.reminderWindow.textContent = `${formatMinutesOfDay(state.reminders.startMinutes)} - ${formatMinutesOfDay(state.reminders.endMinutes)} · 每 ${state.reminders.intervalMinutes} 分钟`;
  elements.reminderStatus.textContent = getReminderStatusText(permission, notificationEnabled);
  elements.reminderToggle.textContent = notificationEnabled ? "关闭通知" : "开启通知";
  elements.reminderToggle.disabled = permission === "denied" || permission === "unsupported";
  elements.reminderCopy.textContent =
    permission === "denied"
      ? "通知已被浏览器或系统阻止，请在浏览器和 macOS 通知设置中允许。"
      : permission === "default"
        ? "首次开启会先请求通知权限。"
        : nextAmount > 0 && nextReminder
      ? `下次提醒 ${formatReminderDateTime(nextReminder)}，建议 ${formatNumber(nextAmount)} ml；今日目标 ${formatNumber(target)} ml。`
      : todayTotal >= target
        ? "今日目标已完成，后续提醒会自动跳过。"
        : `今日提醒时段已结束，明天 ${formatMinutesOfDay(state.reminders.startMinutes)} 继续提醒。`;
  elements.reminderPlan.innerHTML = "";

  reminderSlots.forEach((slot, index) => {
    const planned = plan[index];
    const cumulative = plan.slice(0, index + 1).reduce((sum, amount) => sum + amount, 0);
    const item = document.createElement("li");
    const status = getSlotStatus(selectedDate, slot, total, cumulative);
    item.className = `reminder-slot ${status.className}`;
    item.innerHTML = `
      <time>${formatMinutesOfDay(slot)}</time>
      <strong>${formatNumber(Math.max(0, planned))} ml</strong>
      <span>${status.label}</span>
    `;
    elements.reminderPlan.append(item);
  });
}

function createReminderPlan(target) {
  const reminderSlots = getReminderSlots();
  let remaining = target;
  let slots = reminderSlots.length;
  return reminderSlots.map(() => {
    const amount = Math.max(50, roundToNearest(remaining / slots, 50));
    remaining -= amount;
    slots -= 1;
    return slots === 0 ? amount + remaining : amount;
  });
}

function getReminderStatusText(permission, enabled) {
  if (permission === "native" && enabled) return "系统通知";
  if (permission === "native") return "可用";
  if (permission === "unsupported") return "不支持";
  if (permission === "denied") return "已阻止";
  if (enabled) return "已开启";
  return "未开启";
}

async function ensureNotificationPermission() {
  if (canUseNativeNotifier()) return true;
  if (!("Notification" in window)) return false;
  if (Notification.permission === "granted") return true;
  if (Notification.permission === "denied") return false;
  const permission = await requestNotificationPermission();
  return permission === "granted";
}

function requestNotificationPermission() {
  return new Promise((resolve) => {
    const result = Notification.requestPermission(resolve);
    if (result?.then) {
      result.then(resolve);
    }
  });
}

function getSlotStatus(date, slot, total, cumulative) {
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (total >= cumulative) {
    return { className: "is-complete", label: "已达成" };
  }
  if (!isToday(date)) {
    return { className: "", label: "计划" };
  }
  if (nowMinutes > slot) {
    return { className: "is-past", label: "已过" };
  }
  return { className: "is-upcoming", label: "待提醒" };
}

function scheduleReminderLoop() {
  if (reminderTimer) {
    clearInterval(reminderTimer);
    reminderTimer = null;
  }

  const nativeNotifier = canUseNativeNotifier();
  const browserNotifier = "Notification" in window && Notification.permission === "granted";
  if (!state.reminders.enabled || (!nativeNotifier && !browserNotifier)) {
    return;
  }

  checkReminderDue();
  reminderTimer = setInterval(checkReminderDue, 30 * 1000);
}

function checkReminderDue() {
  const now = new Date();
  const slot = getDueReminderSlot(now);
  if (slot === null) return;

  const key = `${dateKey(now)}-${slot}`;
  if (lastReminderKey === key) return;

  const target = calculateTarget(state.profile);
  const total = sumLogs(state.logs[dateKey(now)] || []);
  const amount = getSuggestedReminderAmount(now, target, total);
  if (amount <= 0) return;

  lastReminderKey = key;
  sendReminderNotification("喝水提醒", `现在建议喝 ${formatNumber(amount)} ml。已记录 ${formatNumber(total)} ml，目标 ${formatNumber(target)} ml。`);
}

async function sendReminderNotification(title, body) {
  if (canUseNativeNotifier()) {
    try {
      const response = await fetch("/api/notify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, body })
      });
      if (response.ok) return;
    } catch {
      // Fall back to browser notifications below.
    }
  }

  if (!("Notification" in window) || Notification.permission !== "granted") return;
  new Notification(title, {
    body,
    tag: "daily-water-reminder",
    renotify: true
  });
}

function canUseNativeNotifier() {
  return (
    location.protocol === "http:" &&
    (location.hostname === "127.0.0.1" || location.hostname === "localhost")
  );
}

function sendReminderNotificationLater(title, body) {
  setTimeout(() => {
    sendReminderNotification(title, body);
  }, 500);
}

function getSuggestedReminderAmount(now, target, total) {
  const remaining = Math.max(0, target - total);
  if (remaining === 0) return 0;
  const nextReminder = getNextReminderDate(now);
  if (!nextReminder || !isToday(nextReminder)) return 0;
  const reminderSlots = getReminderSlots();
  const nextMinutes = nextReminder.getHours() * 60 + nextReminder.getMinutes();
  const remainingSlots = reminderSlots.filter((slot) => {
    return slot >= nextMinutes;
  }).length;
  const slots = remainingSlots || 1;
  return clampNumber(roundToNearest(remaining / slots, 50), 100, 600, 250);
}

function getNextReminderDate(now) {
  const reminderSlots = getReminderSlots();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const dueSlot = reminderSlots.find((slot) => slot >= currentMinutes);
  const nextSlot = dueSlot ?? reminderSlots[0];
  const daysToAdd = dueSlot === undefined ? 1 : 0;

  return addDaysAtMinutes(now, daysToAdd, nextSlot);
}

function getDueReminderSlot(now) {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const reminderSlots = getReminderSlots();
  return reminderSlots.find((slot) => {
    const delta = nowMinutes - slot;
    return delta >= 0 && delta <= 2;
  }) ?? null;
}

function getReminderSlots() {
  const startValue = roundToNearest(
    clampNumber(state.reminders.startMinutes, 0, 23 * 60 + 30, defaultReminders.startMinutes),
    30
  );
  const endValue = roundToNearest(
    clampNumber(state.reminders.endMinutes, 0, 23 * 60 + 30, defaultReminders.endMinutes),
    30
  );
  const start = Math.min(startValue, endValue);
  const end = Math.max(startValue, endValue);
  const interval = clampNumber(
    state.reminders.intervalMinutes,
    15,
    240,
    defaultReminders.intervalMinutes
  );
  const slots = [];
  for (let minutes = start; minutes <= end; minutes += interval) {
    slots.push(minutes);
  }
  if (slots.at(-1) !== end) slots.push(end);
  return slots;
}

function renderAdvice(target, total) {
  const recommendedTarget = calculateRecommendedTarget(state.profile);
  const remaining = Math.max(0, recommendedTarget - total);
  const profile = state.profile;
  const baseTotal = profile.sex === "male" ? 3700 : 2700;
  const beverageEstimate = Math.round(baseTotal * 0.8);
  const items = [
    {
      title: `${formatNumber(recommendedTarget)} ml 可作为科学建议目标`,
      text: `成人总水适宜摄入量常以女性约 2.7 L、男性约 3.7 L 作为参考，其中食物通常贡献约 20%，饮品目标约 ${formatNumber(beverageEstimate)} ml。`
    },
    {
      title: remaining > 0 ? `还差 ${formatNumber(remaining)} ml` : "今日目标已完成",
      text: "把饮水分散在一天内更容易坚持；运动后、出汗多或炎热天气通常需要额外补水。"
    },
    {
      title: "观察身体反馈",
      text: "口渴、尿色变深、头晕或疲劳可能提示水分不足；肾脏病、心衰或医生要求限水时，应按医嘱执行。"
    }
  ];

  if (profile.pregnant || profile.lactating) {
    items.push({
      title: "孕期与哺乳期",
      text: profile.lactating
        ? "哺乳期通常需要更多液体，本页已提高目标；若有产后或慢性疾病情况，以医生建议为准。"
        : "孕期通常需要略高的总水量，本页已提高目标；个体差异较大，产检建议优先。"
    });
  }

  elements.adviceTag.textContent = "科学建议";
  elements.adviceList.innerHTML = "";
  items.forEach((item) => {
    const node = document.createElement("article");
    node.className = "advice-item";
    node.innerHTML = `<strong>${item.title}</strong><p>${item.text}</p>`;
    elements.adviceList.append(node);
  });
}

function calculateTarget(profile) {
  if (profile.manualTarget) return Number(profile.manualTarget);
  return calculateRecommendedTarget(profile);
}

function calculateRecommendedTarget(profile) {
  const baseTotalWater = profile.sex === "male" ? 3700 : 2700;
  let target = Math.round(baseTotalWater * 0.8);

  const weightAnchor = profile.sex === "male" ? 75 : 60;
  target += Math.round((profile.weight - weightAnchor) * 12);
  target += Math.floor(profile.activity / 30) * 350;
  if (profile.hotDay) target += 500;
  if (profile.pregnant) target += 240;
  if (profile.lactating) target += 560;

  return Math.round(clampNumber(target, 1200, 5200, target) / 50) * 50;
}

function syncProfileForm() {
  const profile = state.profile;
  elements.profileForm.elements.sex.value = profile.sex;
  elements.profileForm.elements.weight.value = profile.weight;
  elements.profileForm.elements.activity.value = profile.activity;
  elements.profileForm.elements.hotDay.checked = profile.hotDay;
  elements.profileForm.elements.pregnant.checked = profile.pregnant;
  elements.profileForm.elements.lactating.checked = profile.lactating;
  elements.profileForm.elements.manualTarget.value = profile.manualTarget;
}

function syncReminderSettings() {
  elements.reminderStart.value = formatMinutesOfDay(state.reminders.startMinutes);
  elements.reminderEnd.value = formatMinutesOfDay(state.reminders.endMinutes);
  elements.reminderInterval.value = state.reminders.intervalMinutes;
}

function sumLogs(logs) {
  return logs.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function labelForAmount(amount) {
  if (amount <= 180) return "小杯";
  if (amount <= 300) return "常用杯";
  if (amount <= 400) return "大杯";
  return "水瓶";
}

function normalizeOptionalNumber(value, min, max) {
  if (value === "" || value === null) return "";
  return clampNumber(value, min, max, "");
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(max, Math.max(min, Math.round(number)));
}

function roundToNearest(value, step) {
  return Math.round(value / step) * step;
}

function startOfDay(date) {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
}

function addDays(date, days) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addDaysAtHour(date, days, hour) {
  const next = addDays(date, days);
  next.setHours(hour, 0, 0, 0);
  return next;
}

function addDaysAtMinutes(date, days, minutesOfDay) {
  const next = addDays(date, days);
  next.setHours(Math.floor(minutesOfDay / 60), minutesOfDay % 60, 0, 0);
  return next;
}

function parseTimeMinutes(value, fallback) {
  const [hour, minute] = String(value || "").split(":");
  const minutes = Number(hour) * 60 + Number(minute || 0);
  if (!Number.isFinite(minutes)) return fallback;
  return roundToNearest(clampNumber(minutes, 0, 23 * 60 + 30, fallback), 30);
}

function formatMinutesOfDay(minutesOfDay) {
  const hour = Math.floor(minutesOfDay / 60);
  const minute = minutesOfDay % 60;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isToday(date) {
  return dateKey(date) === dateKey(new Date());
}

function formatDate(date) {
  if (isToday(date)) return "今天";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short"
  }).format(date);
}

function formatTime(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function formatReminderDateTime(date) {
  const time = formatTime(date);
  if (isToday(date)) return `今天 ${time}`;
  return `明天 ${time}`;
}

function shortWeekday(date) {
  if (isToday(date)) return "今";
  return new Intl.DateTimeFormat("zh-CN", { weekday: "short" }).format(date).replace("周", "");
}

function formatNumber(value) {
  return new Intl.NumberFormat("zh-CN").format(value);
}
