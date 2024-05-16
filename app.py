
import os
import json
import uuid
import time
import glob
import shutil
import base64
import atexit
import collections

from apscheduler.schedulers.background import BackgroundScheduler
from flask import Flask

app = Flask(__name__)

processed_records = 0
EXECS_COUNT_FILE = 'static/data/execs_count.txt'

RECORD_FOLDER = 'static/data/records'

STATE_GRAPH_FILE = 'static/data/states.json'
"""
Represents state graph
[
  {
    "name": "203",
    "nextStates": [
      "203",
      "300"
    ],
    "hitCount": 123
  },
  {
    "name": "300",
    "nextStates": [],
    "hitCount": 172
  }
]
"""

STATE_HIT_COUNT = 'static/data/state_hit_count.json'

STATE_SEQ_SEED_FILE = 'static/data/state_seq_seed.json'
PER_STATE_SEQ_SEED_LIMIT = 10
"""
Represents the mapping of state sequences to the corresponding seeds' filenames
Delimiter/identifier = $$$ per state
{
    "200$$$203$$$400": ["filename1", "filename2", "filename3"],
    "300$$$203$$$405": ["filename4", "filename5"]
}

"""

SEED_FOLDER = 'static/data/seeds'
"""
Folder containing seeds (in binary form)
"""

def get_state_graph_db_as_graph():
    with open(STATE_GRAPH_FILE, 'r') as f:
        db = json.load(f)
        db_graph = collections.defaultdict(list)
        db_hit_count = collections.defaultdict(int)
        for state in db:
            db_graph[state["name"]] = state["nextStates"]
            db_hit_count[state["name"]] = state["hitCount"]
        return (db_graph, db_hit_count)

def flush_state_graph_db_from_graph(db_graph, db_hit_count):
    db = []
    for state_name, next_states in db_graph.items():
        db.append(
            {
                'name': state_name,
                'nextStates': list(set(next_states)),
                'hitCount': db_hit_count[state_name]
            })
    db = sorted(db, key=lambda e: e['name'])
    with open(STATE_GRAPH_FILE, 'w') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
        f.write('\n')

def init_empty_state_graph_db():
    flush_state_graph_db_from_graph({}, {})

# ---

def get_state_seq_seed_db():
    with open(STATE_SEQ_SEED_FILE, 'r') as f:
        db = json.load(f)
        return db

def flush_state_seq_seed_db(db):
    with open(STATE_SEQ_SEED_FILE, 'w') as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
        f.write('\n')

def init_empty_state_seq_seed_db():
    flush_state_seq_seed_db({})

# ---

def write_seed(seed, fname):
    with open(fname, 'wb') as f:
        f.write(seed)

def clear_seed_data():
    if os.path.exists(SEED_FOLDER):
        shutil.rmtree(SEED_FOLDER)
    os.mkdir(SEED_FOLDER)

# ---

def write_execs():
    global processed_records
    with open(EXECS_COUNT_FILE, 'wb') as f:
        f.write(str(processed_records))

# ---

def clear_record_data():
    if os.path.exists(RECORD_FOLDER):
        shutil.rmtree(RECORD_FOLDER)
    os.mkdir(RECORD_FOLDER)

def reset_dbs():
    init_empty_state_graph_db()
    init_empty_state_seq_seed_db()
    clear_seed_data()
    clear_record_data()
    write_execs()


"""
form:
(['202', '200', '203'], 'Q5YACgAAA...')
represents 202 -> 200 -> 203
and the seed that represents it is 'seed'
"""
def add_state_sequence(inp_tuple, db_graph, db_hit_count, db_state_seq):    
    global processed_records
    state_sequence, b64seed = inp_tuple

    # generate graph
    for i in range(len(state_sequence)-1):
        cur_state = state_sequence[i]
        next_state = state_sequence[i+1]
        db_graph[cur_state].append(next_state)
        db_hit_count[cur_state] += 1
    if state_sequence[-1] not in db_graph:
        db_graph[state_sequence[-1]] = []
        db_hit_count[state_sequence[-1]] += 1

    # state seq db
    state_seq_key = '$$$'.join(state_sequence)
    if state_seq_key not in db_state_seq:
        db_state_seq[state_seq_key] = []
    if len(db_state_seq[state_seq_key]) < PER_STATE_SEQ_SEED_LIMIT:
        # get seed in the form of b64 string
        seed = base64.b64decode(b64seed)
        # generate random filename
        fname = uuid.uuid4().hex
        fname = os.path.join(SEED_FOLDER, fname)
        # upload seed
        write_seed(seed, fname)
        db_state_seq[state_seq_key].append(fname)
    processed_records += 1
    write_execs()

def sync_from_record():
    """
    record format:
    state1$$$state2$$$state3
    YW5ueWVvbmdoYXNleW9taWNjaHk=
    """
    db_graph, db_hit_count = get_state_graph_db_as_graph()
    db_state_seq = get_state_seq_seed_db()
    
    for file in glob.glob(RECORD_FOLDER + '/*'):
        with open(file, 'r') as f:
            # parse record
            tmp = f.read().split('\n')
            seq = tmp[0].split('$$$')
            seed = tmp[1]
            add_state_sequence((seq, seed), db_graph, db_hit_count, db_state_seq)
        os.remove(file)

    flush_state_graph_db_from_graph(db_graph, db_hit_count)
    flush_state_seq_seed_db(db_state_seq)

def cronjob():
    global processed_records
    print('Updating DBs...')
    print(time.strftime("%A, %d. %B %Y %I:%M:%S %p"))
    print('Processed records:', processed_records)
    sync_from_record()

@app.route('/<path:path>')
def static_file(path):
    return app.send_static_file(path)

if __name__ == '__main__':

    sched = BackgroundScheduler(daemon=True)
    sched.add_job(cronjob, 'interval', seconds=10)
    sched.start()
    atexit.register(lambda: sched.shutdown(wait=False))

    reset_dbs()
    app.run("0.0.0.0", 6789)


