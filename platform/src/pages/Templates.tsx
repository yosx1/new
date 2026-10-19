import { Link, useNavigate } from 'react-router-dom';
import { useData } from '../data/DataProvider';
import { useI18n } from '../i18n/I18n';
import { Badge, Card, Empty, PageHead } from '../components/ui';
import { Icon } from '../components/Icon';

export default function Templates() {
  const { t, b } = useI18n();
  const data = useData();
  const nav = useNavigate();
  return (
    <>
      <PageHead title={t('tpl.title')} actions={<button className="btn primary" onClick={() => nav('/templates/new')}><Icon name="plus" />{t('tpl.add')}</button>} />
      <p className="alert warn mb">{t('tpl.exampleWarn')}</p>
      <Card>
        {data.templates.length === 0 ? <Empty /> : (
          <div className="list">
            {data.templates.map(x => {
              const used = data.equipment.filter(e => e.templateIds?.includes(x.id)).length;
              return (
                <Link key={x.id} to={`/templates/${x.id}`} className="lrow" style={{ opacity: x.active ? 1 : .55 }}>
                  <div className="grow">
                    <b className="mono">{x.code}</b> · <b>{b(x.name)}</b>
                    <div className="meta">{t('tpl.categories')}: {x.equipmentCategories.join(', ') || '—'}</div>
                    <div className="meta">{t('tpl.mtypes')}: {x.maintenanceTypes.join(', ') || t('c.all')} · {t('tpl.approvals')}: {x.requiredApprovals.map(d => t('disc.' + d)).join('، ')}</div>
                  </div>
                  <Badge tone="blue">v{x.currentVersion}</Badge>
                  {used > 0 && <Badge tone="gray">{used} {t('c.equipment')}</Badge>}
                  {!x.active && <Badge tone="gray">{t('c.inactive')}</Badge>}
                </Link>
              );
            })}
          </div>
        )}
      </Card>
    </>
  );
}
