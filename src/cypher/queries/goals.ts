import Cypher from '@neo4j/cypher-builder';
import { userById } from '../nodes/user.js';
import { goalCreate } from '../nodes/goal.js';
import { userHasGoal } from '../patterns/user-goal.js';

/**
 * Helper для Goal projection
 */
function projectGoal(goalNode: Cypher.Node): Cypher.MapProjection {
  return new Cypher.MapProjection(goalNode, [
    'userId',
    'targetCriteria',
    'createdAt'
  ]);
}

/**
 * Установить/обновить цель пользователя
 */
export function setGoalQuery(): Cypher.Return {
  const { node: user, pattern: userPattern } = userById('userId');
  const { node: goal } = goalCreate();

  return new Cypher.Merge(userPattern)
    .merge(userHasGoal(user, goal))
    .onCreateSet(
      [goal.property('userId'), new Cypher.NamedParam('userId', 'userId')],
      [goal.property('createdAt'), new Cypher.NamedParam('createdAt', 'createdAt')],
      [goal.property('targetCriteria'), new Cypher.NamedParam('targetCriteria', 'targetCriteria')]
    )
    .onMatchSet(
      [goal.property('targetCriteria'), new Cypher.NamedParam('targetCriteria', 'targetCriteria')]
    )
    .return([goal.property('userId'), 'userId']);
}

/**
 * Получить цель пользователя
 */
export function getUserGoalQuery(): Cypher.Return {
  const { node: user, pattern: userPattern } = userById('userId');
  const { node: goal } = goalCreate();

  const pattern = userPattern
    .related(new Cypher.NamedRelationship('hasGoal'), { type: 'HAS_GOAL' })
    .to(goal, { labels: ['Goal'] });

  return new Cypher.Match(pattern)
    .return([projectGoal(goal), 'goal']);
}

/**
 * Удалить цель пользователя
 */
export function deleteGoalQuery(): Cypher.Return {
  const { node: user, pattern: userPattern } = userById('userId');
  const { node: goal } = goalCreate();
  const hasGoalRel = new Cypher.NamedRelationship('rel');

  const pattern = userPattern
    .related(hasGoalRel, { type: 'HAS_GOAL' })
    .to(goal, { labels: ['Goal'] });

  return new Cypher.Match(pattern)
    .detachDelete(goal)
    .return([
      Cypher.gt(Cypher.count(hasGoalRel), new Cypher.Literal(0)),
      'success'
    ]);
}
