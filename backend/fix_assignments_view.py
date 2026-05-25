import re

filepath = r'c:\Users\John Gargoles\OneDrive\Desktop\dummy\frontend\src\components\AssignmentsView.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Remove opacity: 0.8 from graded items
content = content.replace(
    "borderRadius: '12px', marginBottom: '8px', opacity: 0.8 }}",
    "borderRadius: '12px', marginBottom: '8px' }}"
)

# 2. Replace the static grade badge with an editable one
old_grade_display = """                          <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>{s.grade}/{showSubs.max_points}</span>
                        </div>
                      </div>
                    ))}"""

new_grade_display = """                          {gradeId === s.id ? (
                            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                              <input type="number" min={0} max={showSubs.max_points} className="input" style={{ width: 60, padding: '6px 8px', fontSize: 12 }} placeholder="Grade" value={gradeVal} onChange={e => setGradeVal(e.target.value)} />
                              <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 11 }} onClick={() => handleGrade(s.id)}>Save</button>
                              <button className="btn-secondary" style={{ padding: '6px 8px', fontSize: 11 }} onClick={() => setGradeId(null)}>{String.fromCharCode(10005)}</button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ background: '#dcfce7', color: '#16a34a', padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: 800 }}>{s.grade}/{showSubs.max_points}</span>
                              {canCreate && <button onClick={() => { setGradeId(s.id); setGradeVal(String(s.grade)); setGradeFeedback(''); }} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', fontSize: 11, color: 'var(--accent)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}><i className="fas fa-edit" style={{ fontSize: 10 }}></i> Edit</button>}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}"""

# Find and replace - handle both LF and CRLF
old_lf = old_grade_display
old_crlf = old_grade_display.replace('\n', '\r\n')

if old_crlf in content:
    content = content.replace(old_crlf, new_grade_display.replace('\n', '\r\n'))
    print("Replaced with CRLF")
elif old_lf in content:
    content = content.replace(old_lf, new_grade_display)
    print("Replaced with LF")
else:
    print("ERROR: Could not find the target content!")
    # Debug: show what's around grade/showSubs.max_points
    idx = content.find("{s.grade}/{showSubs.max_points}")
    if idx >= 0:
        # Find the second occurrence (graded section)
        idx2 = content.find("{s.grade}/{showSubs.max_points}", idx + 1)
        if idx2 >= 0:
            print(f"Found second occurrence at index {idx2}")
            print(repr(content[idx2-100:idx2+200]))
        else:
            print(f"Only one occurrence at index {idx}")
            print(repr(content[idx-100:idx+200]))

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done!")
