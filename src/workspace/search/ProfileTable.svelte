<script>
  import isEmpty from 'lodash/isEmpty'
  import { useStoreon } from '@storeon/svelte'

  import Shard from './profiling/Shard.svelte'

  const { dispatch, search } = useStoreon('search')
</script>

<div class="profile-table">
  {#if !isEmpty($search.profile)}
    <h4 class="ui header">Affected Shards</h4>
    <div class="ui styled fluid accordion">
      {#each $search.profile.shards as shard, i}
        <div class="profile-table__shard">
          <Shard {shard} />
        </div>
      {/each}
    </div>
  {/if}
</div>
