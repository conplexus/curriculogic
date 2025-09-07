// src/lib/api.ts

// quick helper
function rand<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const statuses = ["GREEN", "AMBER", "RED", "GRAY"] as const;

export async function getRollup() {
  const nodes: any[] = [];
  const edges: any[] = [];

  let idCounter = 1;

  // 3 standards
  for (let s = 1; s <= 3; s++) {
    const sid = `std-${idCounter++}`;
    nodes.push({
      id: sid,
      type: "standard",
      label: `Standard ${s}`,
      status: rand(statuses),
    });

    // 2–3 courses per standard
    for (let c = 1; c <= 2 + Math.floor(Math.random() * 2); c++) {
      const cid = `crs-${idCounter++}`;
      nodes.push({
        id: cid,
        type: "course",
        label: `Course ${s}.${c}`,
        status: rand(statuses),
      });
      edges.push({ id: `${sid}-${cid}`, source: sid, target: cid });

      // 2–4 CLOs per course
      for (let o = 1; o <= 2 + Math.floor(Math.random() * 3); o++) {
        const oid = `clo-${idCounter++}`;
        nodes.push({
          id: oid,
          type: "clo",
          label: `CLO ${s}.${c}.${o}`,
          status: rand(statuses),
        });
        edges.push({ id: `${cid}-${oid}`, source: cid, target: oid });

        // 1–2 Assessments per CLO
        for (let a = 1; a <= 1 + Math.floor(Math.random() * 2); a++) {
          const aid = `asm-${idCounter++}`;
          nodes.push({
            id: aid,
            type: "assessment",
            label: `Assessment ${s}.${c}.${o}.${a}`,
            status: rand(statuses),
          });
          edges.push({ id: `${oid}-${aid}`, source: oid, target: aid });

          // 2–5 Questions per Assessment
          for (let q = 1; q <= 2 + Math.floor(Math.random() * 4); q++) {
            const qid = `q-${idCounter++}`;
            nodes.push({
              id: qid,
              type: "question",
              label: `Q${s}.${c}.${o}.${a}.${q}`,
              status: rand(statuses),
              parentId: aid, // ⚡ later: supports group-node parenting
            });
            edges.push({ id: `${aid}-${qid}`, source: aid, target: qid });
          }
        }
      }
    }
  }

  return { nodes, edges };
}
