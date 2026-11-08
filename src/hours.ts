const weekdays = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const heading = /^(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday):\s*(.*)$/i;

export function formatHours(value: string) {
  const lines = value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const entries = new Map<number, string>();
  for (let index = 0; index < lines.length; index++) {
    const match = heading.exec(lines[index]);
    if (!match) return value;
    const day = weekdays.findIndex(name => name.toLowerCase() === match[1].toLowerCase());
    const time = match[2] || lines[++index];
    if (!time || heading.test(time) || entries.has(day)) return value;
    entries.set(day, time.replace(/\s+/g, ' ').trim());
  }
  const groups = new Map<string, number[]>();
  for (const [day, time] of [...entries].sort(([a],[b]) => a-b)) {
    const days = groups.get(time) || [];
    days.push(day); groups.set(time, days);
  }
  return [...groups].map(([time, days]) => {
    const ranges: {start: number; end: number}[] = [];
    for (const day of days) {
      const previous = ranges.at(-1);
      if (previous && previous.end + 1 === day) previous.end = day;
      else ranges.push({start: day, end: day});
    }
    const label = ranges.map(({start,end}) => start === end ? weekdays[start] : `${weekdays[start]}–${weekdays[end]}`).join(', ');
    return `${label}:\n${time}`;
  }).join('\n');
}
