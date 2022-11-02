
/**
 * @param  {number} a
 * @param  {number} b
 * @return {boolean}
 */
export function lte(b) {
    return function (a) {
        return a <= b;
    }
}

/**
 * @param  {string} property
 */
export function getProperty(property) {
    return function (value) {
        return value[property];
    };
}



/**
 * @param  {Array<(arg: any) => any> | () => Array<(arg: any) => any>} steps
 * @return {(arg: any) => any}
 */

export function pipe(steps) {
    // let returnStatement = undefined;

    // function setReturnValue(value) {
    //     if (returnStatement) {
    //         return;
    //     }

    //     returnStatement = {
    //         value,
    //     };

    //     throw returnStatement;
    // }

    // if (typeof steps === "function") {
    //     steps = steps({ returnValue: setReturnValue })
    // }

    return async function (value) {
        for (const step of steps) {
            // try {
                value = await step(value);
            // } catch (exception) {
            //     if (exception !== returnStatement) {
            //         throw exception;
            //     }

            //     return returnStatement.value;
            // }
        }

        return value;
    };
}
/**
 * @param  {(value: any) => boolean | Promise<boolean>} predicate
 */
export function if_(predicate) {
    return {
        then_(step) {
            return async function (value) {
                if (await predicate(value)) {
                    return await step(value);
                }

                return value;
            }
        }
    }
}

/**
 * @param  {(value: any) => boolean | Promise<boolean>} getOtherValue
 */
export function equals_(getOtherValue) {
    return async function (value) {
        return (value === await getOtherValue(value));
    }
}



// const getLocalSnapshotDate = pipe([
//     () => ("last-snapshot.json"),
//     getFileUriContent,
//     JSON.parse,
//     getProperty("localSnapshotTimestamp"),

//     if_(equals_(() => (undefined))).then_(
//         () => ("1970-01-01T00:00:00Z"),
//     ),
// ]);