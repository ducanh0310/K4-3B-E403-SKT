function ageHours(firstSeen, now) {
  return Math.max(0, (now.getTime() - new Date(firstSeen).getTime()) / 3_600_000);
}

export function deriveStatus(issue, now = new Date(), stuckAfterHours = 4) {
  if (issue.status === 'RESOLVED') return 'RESOLVED';
  if (issue.status === 'NEEDS_REVIEW') return 'NEEDS_REVIEW';
  return ageHours(issue.firstSeen, now) >= stuckAfterHours ? 'STUCK' : issue.status;
}

function priority(issue, now) {
  const urgency = { critical: 100, high: 50, normal: 0, low: -10 }[issue.urgency] ?? 0;
  const review = issue.derivedStatus === 'NEEDS_REVIEW' ? 30 : 0;
  return urgency + review + issue.uniqueAskers * 10 + Math.min(ageHours(issue.firstSeen, now), 24);
}

export function buildDigest(issues, { now = new Date(), stuckAfterHours = 4 } = {}) {
  const enriched = issues.map(issue => ({ ...issue, derivedStatus: deriveStatus(issue, now, stuckAfterHours) }));
  const actionItems = enriched
    .filter(issue => issue.derivedStatus !== 'RESOLVED')
    .sort((left, right) => priority(right, now) - priority(left, now));
  const hotTopics = enriched
    .filter(issue => issue.derivedStatus !== 'RESOLVED')
    .sort((left, right) => right.uniqueAskers - left.uniqueAskers || right.questionCount - left.questionCount)
    .slice(0, 5);
  const lines = [`📋 TA DIGEST — ${new Intl.DateTimeFormat('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }).format(now)}`, '', '🚨 CẦN XỬ LÝ'];
  if (!actionItems.length) lines.push('Không có issue đang mở.');
  for (const [index, issue] of actionItems.slice(0, 10).entries()) {
    lines.push(`${index + 1}. ${issue.title}`, `   ${issue.uniqueAskers} học viên · ${issue.questionCount} câu · ${issue.derivedStatus}`);
    lines.push(`   ID: ${issue.id}`);
    if (issue.requiresOfficialSource) {
      const source = issue.officialSources?.[0];
      lines.push(source?.sourceUrl ? `   Nguồn chính thức: ${source.sourceUrl}` : '   ⚠️ Chưa có nguồn chính thức');
    }
    if (issue.representativeJumpUrl) lines.push(`   ${issue.representativeJumpUrl}`);
  }
  lines.push('', '🔥 CHỦ ĐỀ NÓNG');
  for (const issue of hotTopics) lines.push(`• ${issue.title}: ${issue.uniqueAskers} học viên · ${issue.questionCount} câu`);
  return { actionItems, hotTopics, text: lines.join('\n') };
}
