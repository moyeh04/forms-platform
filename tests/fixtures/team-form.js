/**
 * A team form with every kind of field the rules check, and a valid answer
 * to it, for the tests of the rules.
 */
const teamForm = {
  fields: [
    { id: 'email', type: 'email', role: 'email' },
    { id: 'leader_name', type: 'arabic_name', role: 'name' },
    { id: 'leader_code', type: 'code', role: 'code' },
    { id: 'phone', type: 'phone', role: 'phone' },
    { id: 'level', type: 'select', options: [{ value: 'a' }, { value: 'b' }] },
    {
      id: 'members',
      type: 'members',
      role: 'members',
      max: 2,
      fields: [
        { id: 'name', type: 'arabic_name', role: 'name' },
        { id: 'code', type: 'code', role: 'code' }
      ]
    },
    { id: 'title', type: 'english_text', role: 'title' }
  ]
};
const base = () => ({
  email: 'A@B.com',
  leader_name: 'أحمد محمد محمود أحمد',
  leader_code: '4230999',
  phone: '+201012345678',
  level: 'a',
  members: [{ name: 'سارة خالد حسن علي', code: '4230998' }],
  title: 'Library System'
});

module.exports = { teamForm, base };
