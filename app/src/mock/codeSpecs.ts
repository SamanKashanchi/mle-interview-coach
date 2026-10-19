// Runnable specs for the mock coding questions. Same shape and tests as the real ones in Supabase.
import type { CodeSpec } from '../lib/types'

export const REPEAT_BUYERS_PROMPT = "Whatnot's growth team wants to know which sellers turn buyers into **repeat buyers quickly**.\n\nYou get a list of orders and a window `k` in days. A buyer counts as a **quick repeat buyer** for a seller if they placed two orders with that seller whose days differ by **at most `k`**. Return, for every seller that appears in `orders`, how many distinct quick repeat buyers they have.\n\n```python\ndef repeat_buyers(orders: list[tuple[int, str, str]], k: int) -> dict[str, int]:\n    ...\n```\n\n### Example\n\nInput, with `k = 3`:\n\n| day | seller_id | buyer_id |\n|---|---|---|\n| 1 | s1 | b1 |\n| 5 | s1 | b2 |\n| 3 | s1 | b1 |\n| 9 | s1 | b2 |\n| 2 | s2 | b1 |\n| 2 | s2 | b1 |\n| 4 | s3 | b3 |\n| 10 | s1 | b2 |\n\n**Expected output:** `{\"s1\": 2, \"s2\": 1, \"s3\": 0}`\n\n### Explanation\n\n- **s1, b1**: orders on days 1 and 3, gap 2 \u2264 3, so b1 counts.\n- **s1, b2**: days 5, 9, 10. 5 to 9 is too far, but 9 to 10 is 1, so b2 counts.\n- **s2, b1**: two orders on day 2, gap 0, so b1 counts.\n- **s3**: only one order, so 0, but s3 is still in the output.\n\nState time and space complexity in a comment."

export const REPEAT_BUYERS: CodeSpec = {
  "language": "python",
  "entry": "repeat_buyers",
  "params": [
    "orders",
    "k"
  ],
  "starter": "def repeat_buyers(orders: list[tuple[int, str, str]], k: int) -> dict[str, int]:\n    # orders: (day, seller_id, buyer_id), not sorted\n    pass\n",
  "tests": [
    {
      "name": "Example",
      "hidden": false,
      "args": [
        [
          [
            1,
            "s1",
            "b1"
          ],
          [
            5,
            "s1",
            "b2"
          ],
          [
            3,
            "s1",
            "b1"
          ],
          [
            9,
            "s1",
            "b2"
          ],
          [
            2,
            "s2",
            "b1"
          ],
          [
            2,
            "s2",
            "b1"
          ],
          [
            4,
            "s3",
            "b3"
          ],
          [
            10,
            "s1",
            "b2"
          ]
        ],
        3
      ],
      "expected": {
        "s1": 2,
        "s2": 1,
        "s3": 0
      }
    },
    {
      "name": "k = 0, same day only",
      "hidden": false,
      "args": [
        [
          [
            4,
            "a",
            "x"
          ],
          [
            4,
            "a",
            "x"
          ],
          [
            5,
            "a",
            "y"
          ],
          [
            6,
            "a",
            "y"
          ],
          [
            1,
            "b",
            "x"
          ]
        ],
        0
      ],
      "expected": {
        "a": 1,
        "b": 0
      }
    },
    {
      "name": "Empty input",
      "hidden": true,
      "args": [
        [],
        5
      ],
      "expected": {}
    },
    {
      "name": "Pair qualifies late",
      "hidden": true,
      "args": [
        [
          [
            0,
            "s",
            "b"
          ],
          [
            10,
            "s",
            "b"
          ],
          [
            30,
            "s",
            "b"
          ],
          [
            31,
            "s",
            "b"
          ]
        ],
        2
      ],
      "expected": {
        "s": 1
      }
    },
    {
      "name": "Buyer counted once per seller",
      "hidden": true,
      "args": [
        [
          [
            1,
            "s",
            "b"
          ],
          [
            2,
            "s",
            "b"
          ],
          [
            3,
            "s",
            "b"
          ],
          [
            1,
            "t",
            "b"
          ],
          [
            9,
            "t",
            "b"
          ]
        ],
        1
      ],
      "expected": {
        "s": 1,
        "t": 0
      }
    },
    {
      "name": "Unsorted, many sellers",
      "hidden": true,
      "args": [
        [
          [
            7,
            "s2",
            "b1"
          ],
          [
            1,
            "s1",
            "b1"
          ],
          [
            6,
            "s1",
            "b2"
          ],
          [
            2,
            "s1",
            "b1"
          ],
          [
            3,
            "s2",
            "b1"
          ],
          [
            0,
            "s1",
            "b2"
          ],
          [
            5,
            "s3",
            "b9"
          ]
        ],
        4
      ],
      "expected": {
        "s2": 1,
        "s1": 1,
        "s3": 0
      }
    }
  ]
}

export const COHORT_SQL: CodeSpec = {
  "language": "sql",
  "starter": "-- PostgreSQL. Tables: buyers, show_events.\nselect\n  date_trunc('week', b.first_seen_at)::date as cohort_week\nfrom buyers b\n",
  "schema": "create table buyers (buyer_id int primary key, first_seen_at timestamp);\ncreate table show_events (buyer_id int, show_id int, event_type text, ts timestamp);",
  "tests": [
    {
      "name": "Example",
      "hidden": false,
      "setup": "insert into buyers values (1,'2026-09-07 10:00'),(2,'2026-09-08 09:00'),(3,'2026-09-09 18:00'),(4,'2026-09-15 12:00'),(5,'2026-09-16 08:00');\ninsert into show_events values (1,101,'join','2026-09-07 10:30'),(1,101,'purchase','2026-09-07 12:30'),(2,102,'join','2026-09-08 09:15'),(2,105,'purchase','2026-09-20 20:00'),(3,103,'join','2026-09-10 20:00'),(3,104,'join','2026-09-11 08:00'),(3,104,'purchase','2026-09-11 14:00'),(4,106,'join','2026-09-15 13:00'),(4,106,'purchase','2026-09-15 19:00');",
      "expected": {
        "columns": [
          "cohort_week",
          "new_buyers",
          "conversion_rate_7d",
          "median_hours_join_to_purchase"
        ],
        "rows": [
          [
            "2026-09-07",
            "3",
            "0.67",
            "10.0"
          ],
          [
            "2026-09-14",
            "2",
            "0.50",
            "6.0"
          ]
        ]
      }
    },
    {
      "name": "No converters in a week",
      "hidden": false,
      "setup": "insert into buyers values (1,'2026-10-05 09:00'),(2,'2026-10-06 09:00'),(3,'2026-10-13 09:00');\ninsert into show_events values (1,1,'join','2026-10-05 10:00'),(1,1,'purchase','2026-10-05 14:00'),(3,2,'join','2026-10-13 10:00');",
      "expected": {
        "columns": [
          "cohort_week",
          "new_buyers",
          "conversion_rate_7d",
          "median_hours_join_to_purchase"
        ],
        "rows": [
          [
            "2026-10-05",
            "2",
            "0.50",
            "4.0"
          ],
          [
            "2026-10-12",
            "1",
            "0.00",
            null
          ]
        ]
      }
    },
    {
      "name": "Purchase exactly 7 days later, two purchases",
      "hidden": true,
      "setup": "insert into buyers values (1,'2026-09-01 08:00'),(2,'2026-09-02 08:00');\ninsert into show_events values (1,1,'join','2026-09-01 09:00'),(1,1,'purchase','2026-09-08 08:00'),(2,2,'join','2026-09-02 09:00'),(2,2,'purchase','2026-09-02 10:00'),(2,3,'purchase','2026-09-02 12:00');",
      "expected": {
        "columns": [
          "cohort_week",
          "new_buyers",
          "conversion_rate_7d",
          "median_hours_join_to_purchase"
        ],
        "rows": [
          [
            "2026-08-31",
            "2",
            "1.00",
            "84.0"
          ]
        ]
      }
    },
    {
      "name": "Sunday and Monday split weeks",
      "hidden": true,
      "setup": "insert into buyers values (1,'2026-09-13 23:00'),(2,'2026-09-14 01:00'),(3,'2026-09-14 02:00');\ninsert into show_events values (1,1,'join','2026-09-13 23:30'),(1,1,'purchase','2026-09-14 03:30'),(2,2,'join','2026-09-14 02:00'),(2,2,'purchase','2026-09-14 04:00'),(3,3,'join','2026-09-14 03:00'),(3,3,'purchase','2026-09-14 11:00');",
      "expected": {
        "columns": [
          "cohort_week",
          "new_buyers",
          "conversion_rate_7d",
          "median_hours_join_to_purchase"
        ],
        "rows": [
          [
            "2026-09-07",
            "1",
            "1.00",
            "4.0"
          ],
          [
            "2026-09-14",
            "2",
            "1.00",
            "5.0"
          ]
        ]
      }
    }
  ]
}
