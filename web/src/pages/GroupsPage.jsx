import { useEffect, useState } from 'react';
import { IoPeopleOutline } from 'react-icons/io5';
import { getGroups, errMsg } from '../services/api';
import { useToast } from '../components/Toast';
import GroupCard from '../components/GroupCard';
import Spinner from '../components/Spinner';
import Empty from '../components/Empty';

export default function GroupsPage() {
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState([]);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      try {
        const { data } = await getGroups();
        setGroups(data.groups || data || []);
      } catch (err) {
        toast.error(errMsg(err));
      } finally {
        setLoading(false);
      }
    })();
  }, [toast]);

  if (loading) return <Spinner full />;

  const shown = filter === 'all' ? groups : groups.filter((g) => g.status === filter);

  return (
    <div>
      <header className="app-header">
        <div>
          <h1>My Groups</h1>
          <div className="greeting">All the savings groups you belong to</div>
        </div>
      </header>

      <div className="screen row gap-8 wrap mt-8 mb-16">
        {['all', 'active', 'completed', 'paused'].map((f) => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? '' : 'btn-ghost'}`}
            style={{ textTransform: 'capitalize' }}
            onClick={() => setFilter(f)}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="screen col gap-12">
        {shown.length === 0 ? (
          <Empty icon={<IoPeopleOutline size={44} />} title="No groups" />
        ) : (
          shown.map((g) => <GroupCard key={g._id} group={g} to={`/groups/${g._id}`} />)
        )}
      </div>
    </div>
  );
}
