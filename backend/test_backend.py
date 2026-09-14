from scheduler import KahnScheduler, WorkflowPayload, WorkflowNode, WorkflowEdge, DAGCycleError

def test_kahn_scheduler_normal():
    payload = WorkflowPayload(
        nodes=[
            WorkflowNode(id="A", type="code_input", label="Node A"),
            WorkflowNode(id="B", type="llm_review", label="Node B"),
            WorkflowNode(id="C", type="test_generator", label="Node C"),
            WorkflowNode(id="D", type="diff_export", label="Node D"),
        ],
        edges=[
            WorkflowEdge(source="A", target="B"),
            WorkflowEdge(source="A", target="C"),
            WorkflowEdge(source="B", target="D"),
            WorkflowEdge(source="C", target="D"),
        ]
    )

    ordered = KahnScheduler.schedule(payload)
    order_ids = [n.id for n in ordered]
    assert order_ids[0] == "A"
    assert "B" in order_ids[1:3]
    assert "C" in order_ids[1:3]
    assert order_ids[3] == "D"
    print("[OK] Normal DAG topological sort passed:", order_ids)

def test_kahn_scheduler_cycle_detection():
    # A -> B -> C -> A (Cycle)
    payload = WorkflowPayload(
        nodes=[
            WorkflowNode(id="A", type="code_input", label="Node A"),
            WorkflowNode(id="B", type="llm_review", label="Node B"),
            WorkflowNode(id="C", type="diff_export", label="Node C"),
        ],
        edges=[
            WorkflowEdge(source="A", target="B"),
            WorkflowEdge(source="B", target="C"),
            WorkflowEdge(source="C", target="A"),
        ]
    )

    try:
        KahnScheduler.schedule(payload)
        assert False, "Should have raised DAGCycleError"
    except DAGCycleError as e:
        assert "Cycle Detected" in str(e)
        print("[OK] Cycle detection passed")

if __name__ == "__main__":
    test_kahn_scheduler_normal()
    test_kahn_scheduler_cycle_detection()
    print("All backend tests passed successfully!")
