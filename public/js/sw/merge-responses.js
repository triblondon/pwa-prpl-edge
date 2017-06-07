function mergeResponses(responsePromises, headers) {
  const readers = responsePromises.map(p => Promise.resolve(p).then(r => r.body.getReader()));
  let doneResolve;
  let doneReject;
  const done = new Promise((r, rr) => {
    doneResolve = r;
    doneReject = rr;
  });

  const readable = new ReadableStream({
    async pull(controller) {
      const reader = await readers[0];

      try {
        const {done, value} = await reader.read();
        if (done) {
          readers.shift();

          if (!readers[0]) {
            controller.close();
            doneResolve();
            return;
          }
          return this.pull(controller);
        }

        controller.enqueue(value);
      }
      catch (err) {
        doneReject(err);
        throw err;
      }
    },
    cancel() {
      doneResolve();
    }
  });

  return {
    done: done,
    response: new Response(readable, {headers: headers})
  };
}
